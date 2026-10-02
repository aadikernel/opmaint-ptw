import { Prisma, PermitStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import * as policy from "../policies/permitPolicy";
import { Actor } from "../policies/permitPolicy";
import { assertTransition, nextStatusAfterApproval, PermitAction } from "../stateMachine/transitions";
import { getTypeDefinition, validateTypeData } from "../permitTypes/registry";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors";
import { writeAudit } from "./auditService";
import { expireDuePermits } from "./expiryService";
import { activationBlockers, factsOf, findApprovalSlot, fullInclude, PermitFull, safetyIssues, toView } from "./permitView";
import { findConflicts } from "./permitService";

type Tx = Prisma.TransactionClient;

const deny = (verdict: string | null) => {
  if (verdict) throw forbidden(verdict);
};

/**
 * Every workflow action goes through here:
 *  1. sweep expired permits (outside the transaction so the expiry is never rolled back)
 *  2. lock the permit row so two requests cannot change it at the same time
 *  3. run the action, then return the fresh permit view
 */
async function withPermit(
  user: Actor,
  id: string,
  now: Date,
  fn: (tx: Tx, p: PermitFull) => Promise<void>,
) {
  await expireDuePermits(now);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Permit" WHERE id = ${id} FOR UPDATE`;
    const p = await tx.permit.findUnique({ where: { id }, include: fullInclude });
    // Not-found is the only hiding we do on writes. Otherwise the policy answers with a clear 403 message.
    if (!p) throw notFound("Permit not found.");
    await fn(tx, p);
    return tx.permit.findUniqueOrThrow({ where: { id }, include: fullInclude });
  });
  const view = toView(result, user, now);
  const conflicts = ["PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED"].includes(result.status) ? await findConflicts(result) : [];
  return { ...view, conflicts };
}

function setStatus(tx: Tx, p: PermitFull, to: PermitStatus, extra: Prisma.PermitUncheckedUpdateInput = {}) {
  return tx.permit.update({ where: { id: p.id }, data: { status: to, ...extra } });
}

/** Problems that make a permit incomplete. Each one becomes a message the UI can show. */
function completenessProblems(p: PermitFull, now: Date): { path: string; message: string }[] {
  const out: { path: string; message: string }[] = [];
  const add = (path: string, message: string) => out.push({ path, message });
  if (!p.contractor.trim()) add("contractor", "Contractor / team is required.");
  if (p.workDescription.trim().length < 10) add("workDescription", "Describe the work (at least 10 characters).");
  if (!p.equipmentId) add("equipmentId", "Select the equipment / location.");
  if (!p.plannedStart) add("plannedStart", "Planned start is required.");
  if (!p.plannedEnd) add("plannedEnd", "Planned end is required.");
  if (p.plannedEnd && p.plannedEnd <= now) add("plannedEnd", "Planned end must be in the future.");
  if (p.hazards.length === 0) add("hazards", "Select at least one hazard.");
  if (p.ppe.length === 0) add("ppe", "Select the PPE required.");
  const pre = (p.precautions as { label: string; confirmed: boolean }[]) ?? [];
  if (pre.length === 0) add("precautions", "Add at least one precaution.");
  else if (pre.some((x) => !x.confirmed)) add("precautions", "Every listed precaution must be confirmed before submitting.");
  return out;
}

export function submitPermit(user: Actor, id: string, now = new Date()) {
  return withPermit(user, id, now, async (tx, p) => {
    deny(policy.canSubmit(user, factsOf(p)));
    const to = assertTransition("submit", p.status);
    const problems = completenessProblems(p, now);
    if (problems.length) throw badRequest("The permit is incomplete: " + problems[0].message, problems);
    const typeData = validateTypeData(p.permitType, p.typeSpecificData, "full");

    // The server decides who must approve. The client can only ADD a Safety Officer, never remove one.
    const def = getTypeDefinition(p.permitType);
    const roles = new Set<"AREA_OWNER" | "SAFETY_OFFICER">(["AREA_OWNER"]);
    if (def.risk === "HIGH" || p.requiredApprovalRoles.includes("SAFETY_OFFICER")) roles.add("SAFETY_OFFICER");

    await tx.permitApproval.deleteMany({ where: { permitId: p.id } });
    await tx.permitApproval.createMany({ data: [...roles].map((r) => ({ permitId: p.id, requiredRole: r })) });
    await setStatus(tx, p, to, {
      submittedAt: now,
      requiredApprovalRoles: [...roles],
      typeSpecificData: typeData as Prisma.InputJsonValue,
    });
    await writeAudit(tx, { permitId: p.id, actor: user, action: "SUBMITTED", fromStatus: p.status, toStatus: to, comment: `Approvals required: ${[...roles].join(", ")}` });
  });
}

function decide(user: Actor, id: string, decision: "APPROVED" | "REJECTED", text: string | undefined, now: Date) {
  const action: PermitAction = decision === "APPROVED" ? "approve" : "reject";
  return withPermit(user, id, now, async (tx, p) => {
    // 1. Own-permit / role / area rules (the critical rule is checked first inside canApprove)
    deny(policy.canApprove(user, factsOf(p)));
    // 2. Is the permit in a state that can be approved?
    assertTransition(action, p.status);
    if (p.plannedEnd && p.plannedEnd <= now) {
      throw conflict("The planned validity window has already ended. Ask the requester to create a new permit.", "WINDOW_PASSED");
    }
    // 3. Which approval does this person fill?
    const slot = findApprovalSlot(user, p.approvals);
    if (!slot) {
      if (p.approvals.some((a) => a.approverId === user.id)) throw conflict("You have already decided on this permit.", "ALREADY_DECIDED");
      throw forbidden("There is no pending approval on this permit that you are allowed to give.");
    }
    await tx.permitApproval.update({
      where: { id: slot.id },
      data: { status: decision, approverId: user.id, comment: text ?? null, decidedAt: now },
    });
    const updated = p.approvals.map((a) => (a.id === slot.id ? { ...a, status: decision } : a));
    const next = decision === "REJECTED" ? "REJECTED" : nextStatusAfterApproval(updated);
    if (next !== p.status) await setStatus(tx, p, next);
    await writeAudit(tx, {
      permitId: p.id,
      actor: user,
      action: decision === "APPROVED" ? "APPROVED" : "REJECTED",
      fromStatus: p.status,
      toStatus: next,
      comment: text ?? null,
    });
  });
}

export const approvePermit = (user: Actor, id: string, comment?: string, now = new Date()) => decide(user, id, "APPROVED", comment, now);
export const rejectPermit = (user: Actor, id: string, reason: string, now = new Date()) => decide(user, id, "REJECTED", reason, now);

export function activatePermit(user: Actor, id: string, now = new Date()) {
  return withPermit(user, id, now, async (tx, p) => {
    deny(policy.canActivate(user, factsOf(p)));
    const to = assertTransition("activate", p.status);
    if (p.approvals.length === 0 || p.approvals.some((a) => a.status !== "APPROVED")) {
      throw conflict("Permit cannot be activated because required approval is missing.", "APPROVAL_MISSING");
    }
    if (p.plannedStart && now < p.plannedStart) {
      throw conflict("Permit cannot be activated before its planned start time.", "BEFORE_PLANNED_START");
    }
    const issues = safetyIssues(p);
    if (issues.length) throw conflict(`Permit cannot be activated: ${issues.join(" ")}`, "SAFETY_CHECK_FAILED");
    await setStatus(tx, p, to, { activatedAt: p.activatedAt ?? now });
    await writeAudit(tx, { permitId: p.id, actor: user, action: "ACTIVATED", fromStatus: p.status, toStatus: to, comment: "Work may now start." });
  });
}

export function suspendPermit(user: Actor, id: string, reason: string, now = new Date()) {
  return withPermit(user, id, now, async (tx, p) => {
    deny(policy.canSuspend(user));
    const to = assertTransition("suspend", p.status);
    await setStatus(tx, p, to);
    await writeAudit(tx, { permitId: p.id, actor: user, action: "SUSPENDED", fromStatus: p.status, toStatus: to, comment: reason });
  });
}

export function resumePermit(user: Actor, id: string, comment: string | undefined, now = new Date()) {
  return withPermit(user, id, now, async (tx, p) => {
    deny(policy.canResume(user));
    const to = assertTransition("resume", p.status);
    // Rule 9: re-check the rules. (Expiry was already handled: an expired permit is EXPIRED, not SUSPENDED.)
    const blockers = activationBlockers(p, now);
    if (blockers.length) throw conflict(`Permit cannot be resumed: ${blockers.join(" ")}`, "RESUME_BLOCKED");
    await setStatus(tx, p, to);
    await writeAudit(tx, { permitId: p.id, actor: user, action: "RESUMED", fromStatus: p.status, toStatus: to, comment: comment ?? "Conditions re-checked." });
  });
}

export function completePermit(user: Actor, id: string, completionNotes: string, now = new Date()) {
  return withPermit(user, id, now, async (tx, p) => {
    deny(policy.canComplete(user, factsOf(p)));
    const to = assertTransition("complete", p.status);
    await setStatus(tx, p, to, { completionNotes, closedAt: now });
    await writeAudit(tx, { permitId: p.id, actor: user, action: "WORK_COMPLETED", fromStatus: p.status, toStatus: to, comment: completionNotes });
  });
}

export function verifyClosure(user: Actor, id: string, input: { areaClean: boolean; workComplete: boolean; comment?: string }, now = new Date()) {
  return withPermit(user, id, now, async (tx, p) => {
    deny(policy.canVerify(user, factsOf(p)));
    const to = assertTransition("verify", p.status);
    if (!input.areaClean || !input.workComplete) {
      throw conflict("Closure cannot be verified until the area is clean and the work is complete.", "CLOSURE_CHECK_FAILED");
    }
    await tx.closureVerification.create({
      data: { permitId: p.id, verifierId: user.id, areaClean: true, workComplete: true, comment: input.comment ?? null, verifiedAt: now },
    });
    await setStatus(tx, p, to);
    await writeAudit(tx, { permitId: p.id, actor: user, action: "CLOSURE_VERIFIED", fromStatus: p.status, toStatus: to, comment: input.comment ?? "Area clean and work complete." });
  });
}

export function cancelPermit(user: Actor, id: string, reason: string, now = new Date()) {
  return withPermit(user, id, now, async (tx, p) => {
    deny(policy.canCancel(user, factsOf(p)));
    const to = assertTransition("cancel", p.status);
    await setStatus(tx, p, to);
    await writeAudit(tx, { permitId: p.id, actor: user, action: "CANCELLED", fromStatus: p.status, toStatus: to, comment: reason });
  });
}

/** Rule 5: work can only be logged while the permit is ACTIVE. */
export async function addWorkLog(
  user: Actor,
  id: string,
  input: { kind: "NOTE" | "ENTRY" | "EXIT"; personName?: string; note: string },
  now = new Date(),
) {
  await expireDuePermits(now);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Permit" WHERE id = ${id} FOR UPDATE`;
    const p = await tx.permit.findUnique({ where: { id }, include: fullInclude });
    if (!p || !policy.canView(user, factsOf(p))) throw notFound("Permit not found.");
    deny(policy.canLogWork(user, factsOf(p)));
    if (p.status !== "ACTIVE") {
      throw conflict(`Work can only be logged against an ACTIVE permit. This permit is ${p.status}.`, "NOT_ACTIVE");
    }
    if (input.kind !== "NOTE" && p.permitType !== "CONFINED_SPACE") {
      throw badRequest("Entry/exit records only apply to confined space permits.");
    }
    return tx.workLog.create({
      data: { permitId: id, userId: user.id, kind: input.kind, personName: input.personName ?? null, note: input.note, loggedAt: now },
      include: { user: { select: { id: true, name: true } } },
    });
  });
}

export async function listWorkLogs(user: Actor, id: string, now = new Date()) {
  await expireDuePermits(now);
  const p = await prisma.permit.findUnique({ where: { id }, include: fullInclude });
  if (!p || !policy.canView(user, factsOf(p))) throw notFound("Permit not found.");
  return prisma.workLog.findMany({ where: { permitId: id }, orderBy: { loggedAt: "asc" }, include: { user: { select: { id: true, name: true } } } });
}
