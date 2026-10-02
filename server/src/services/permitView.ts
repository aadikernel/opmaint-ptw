import { Prisma, PermitStatus } from "@prisma/client";
import { Actor, PermitFacts } from "../policies/permitPolicy";
import * as policy from "../policies/permitPolicy";
import { canTransition, PermitAction } from "../stateMachine/transitions";
import { getTypeDefinition } from "../permitTypes/registry";

export const fullInclude = {
  requester: { select: { id: true, name: true, email: true } },
  equipment: { include: { area: { include: { plant: true } } } },
  approvals: { include: { approver: { select: { id: true, name: true } } } },
  closure: { include: { verifier: { select: { id: true, name: true } } } },
} satisfies Prisma.PermitInclude;

export type PermitFull = Prisma.PermitGetPayload<{ include: typeof fullInclude }>;
type Approval = PermitFull["approvals"][number];

export const factsOf = (p: PermitFull): PermitFacts => ({
  requesterId: p.requesterId,
  areaId: p.equipment?.areaId ?? null,
  status: p.status,
});

export const displayNumber = (n: number) => `PTW-${String(n).padStart(4, "0")}`;

/**
 * Which approval slot would this user fill? A person can fill at most ONE slot per permit,
 * so a Safety Officer cannot single-handedly satisfy both the Area Owner and Safety Officer slots.
 */
export function findApprovalSlot(user: Actor, approvals: Pick<Approval, "approverId" | "status" | "requiredRole" | "id">[]) {
  if (approvals.some((a) => a.approverId === user.id)) return null;
  const pending = approvals.filter((a) => a.status === "PENDING");
  const own = pending.find((a) => a.requiredRole === user.role);
  if (own) return own;
  if (user.role === "SAFETY_OFFICER" || user.role === "ADMIN") return pending[0] ?? null;
  return null;
}

/** Safety problems that block activation / resume right now (excluding approval and timing). */
export function safetyIssues(p: Pick<PermitFull, "permitType" | "typeSpecificData">): string[] {
  try {
    return getTypeDefinition(p.permitType).activationIssues(p.typeSpecificData as Record<string, any>);
  } catch {
    return ["Type-specific safety data is incomplete."];
  }
}

export function activationBlockers(p: PermitFull, now: Date): string[] {
  const out: string[] = [];
  if (p.approvals.length === 0 || p.approvals.some((a) => a.status !== "APPROVED")) out.push("Required approval is missing.");
  if (p.plannedStart && now < p.plannedStart) out.push("Planned start time has not been reached.");
  out.push(...safetyIssues(p));
  return out;
}

export function allowedActions(user: Actor, p: PermitFull): string[] {
  const f = factsOf(p);
  const can = (a: PermitAction, verdict: policy.Verdict) => canTransition(a, p.status) && verdict === null;
  const out: string[] = [];
  if (p.status === "DRAFT" && policy.canEditDraft(user, f) === null) out.push("edit");
  if (can("submit", policy.canSubmit(user, f))) out.push("submit");
  if (can("approve", policy.canApprove(user, f)) && findApprovalSlot(user, p.approvals)) out.push("approve", "reject");
  if (can("activate", policy.canActivate(user, f))) out.push("activate");
  if (can("suspend", policy.canSuspend(user))) out.push("suspend");
  if (can("resume", policy.canResume(user))) out.push("resume");
  if (can("complete", policy.canComplete(user, f))) out.push("complete");
  if (can("verify", policy.canVerify(user, f))) out.push("verify");
  if (can("cancel", policy.canCancel(user, f))) out.push("cancel");
  if (p.status === "ACTIVE" && policy.canLogWork(user, f) === null) out.push("logWork");
  if ((p.status === "ACTIVE" || p.status === "SUSPENDED") && policy.canEditSubmitted(user) === null) out.push("editSubmitted");
  return out;
}

/** Shape sent to the browser. The client never computes permissions: it renders `allowedActions`. */
export function toView(p: PermitFull, user: Actor, now: Date) {
  const def = getTypeDefinition(p.permitType);
  const actions = allowedActions(user, p);
  return {
    id: p.id,
    number: p.number,
    displayNumber: displayNumber(p.number),
    permitType: p.permitType,
    typeLabel: def.label,
    risk: def.risk,
    status: p.status as PermitStatus,
    requester: p.requester,
    contractor: p.contractor,
    workDescription: p.workDescription,
    location: p.equipment
      ? {
          plant: { id: p.equipment.area.plant.id, name: p.equipment.area.plant.name },
          area: { id: p.equipment.area.id, name: p.equipment.area.name },
          equipment: { id: p.equipment.id, tag: p.equipment.tag, name: p.equipment.name },
        }
      : null,
    plannedStart: p.plannedStart,
    plannedEnd: p.plannedEnd,
    hazards: p.hazards,
    ppe: p.ppe,
    precautions: p.precautions,
    requiredApprovalRoles: p.requiredApprovalRoles,
    approvals: p.approvals.map((a) => ({
      id: a.id,
      requiredRole: a.requiredRole,
      status: a.status,
      approver: a.approver,
      comment: a.comment,
      decidedAt: a.decidedAt,
    })),
    typeSpecificData: p.typeSpecificData,
    submittedAt: p.submittedAt,
    activatedAt: p.activatedAt,
    closedAt: p.closedAt,
    completionNotes: p.completionNotes,
    closure: p.closure
      ? { verifier: p.closure.verifier, areaClean: p.closure.areaClean, workComplete: p.closure.workComplete, comment: p.closure.comment, verifiedAt: p.closure.verifiedAt }
      : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    allowedActions: actions,
    // Explains why Activate/Resume would be refused right now (shown next to a disabled button)
    blockers: p.status === "APPROVED" || p.status === "SUSPENDED" ? activationBlockers(p, now) : [],
  };
}
