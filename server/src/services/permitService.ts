import { Prisma, PermitStatus, Role } from "@prisma/client";
import { prisma } from "../db/prisma";
import { Actor, canCreate, canEditDraft, canEditSubmitted, canView } from "../policies/permitPolicy";
import { getTypeDefinition, validateTypeData } from "../permitTypes/registry";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors";
import { writeAudit } from "./auditService";
import { expireDuePermits } from "./expiryService";
import { factsOf, fullInclude, PermitFull, toView } from "./permitView";
import { createPermitSchema, listQuerySchema, updatePermitSchema } from "../validators/permit";
import { z } from "zod";

type CreateInput = z.infer<typeof createPermitSchema>;
type UpdateInput = z.infer<typeof updatePermitSchema>;
type ListQuery = z.infer<typeof listQuerySchema>;

const deny = (verdict: string | null) => {
  if (verdict) throw forbidden(verdict);
};

const toDate = (v: string | null | undefined) => (v ? new Date(v) : v === null ? null : undefined);

async function assertEquipmentExists(equipmentId: string | null | undefined) {
  if (!equipmentId) return;
  const eq = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!eq) throw badRequest("Selected equipment does not exist.");
}

function assertWindow(start: Date | null | undefined, end: Date | null | undefined) {
  if (start && end && end <= start) throw badRequest("Planned end must be after planned start.");
}

export async function loadPermitFor(user: Actor, id: string, now: Date): Promise<PermitFull> {
  await expireDuePermits(now);
  const p = await prisma.permit.findUnique({ where: { id }, include: fullInclude });
  // 404 (not 403) when the user may not see it, so permit existence is not leaked.
  if (!p || !canView(user, factsOf(p))) throw notFound("Permit not found.");
  return p;
}

/** Which permits a user is allowed to see (used for lists and statistics). */
export function scopeWhere(user: Actor): Prisma.PermitWhereInput {
  if (user.role === "ADMIN" || user.role === "SAFETY_OFFICER") return {};
  if (user.role === "REQUESTER") return { requesterId: user.id };
  const mine: Prisma.PermitWhereInput[] = [{ requesterId: user.id }];
  if (user.areaId) mine.push({ status: { not: "DRAFT" }, equipment: { areaId: user.areaId } });
  return { OR: mine };
}

export async function createPermit(user: Actor, input: CreateInput, now = new Date()) {
  deny(canCreate(user));
  const typeData = validateTypeData(input.permitType, input.typeSpecificData, "draft");
  await assertEquipmentExists(input.equipmentId);
  const start = toDate(input.plannedStart);
  const end = toDate(input.plannedEnd);
  assertWindow(start, end);

  const permit = await prisma.$transaction(async (tx) => {
    const created = await tx.permit.create({
      data: {
        permitType: input.permitType,
        requesterId: user.id,
        contractor: input.contractor ?? "",
        workDescription: input.workDescription ?? "",
        equipmentId: input.equipmentId ?? null,
        plannedStart: start ?? null,
        plannedEnd: end ?? null,
        hazards: input.hazards ?? [],
        ppe: input.ppe ?? [],
        precautions: (input.precautions ?? []) as Prisma.InputJsonValue,
        requiredApprovalRoles: (input.requiredApprovalRoles ?? []) as Role[],
        typeSpecificData: typeData as Prisma.InputJsonValue,
      },
    });
    await writeAudit(tx, { permitId: created.id, actor: user, action: "CREATED", toStatus: "DRAFT", comment: "Draft permit created." });
    return tx.permit.findUniqueOrThrow({ where: { id: created.id }, include: fullInclude });
  });
  return toView(permit, user, now);
}

const SUBMITTED_EDITABLE = ["workDescription", "hazards", "ppe", "precautions", "typeSpecificData"] as const;

export async function updatePermit(user: Actor, id: string, input: UpdateInput, now = new Date()) {
  await expireDuePermits(now);
  const permit = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Permit" WHERE id = ${id} FOR UPDATE`;
    const p = await tx.permit.findUnique({ where: { id }, include: fullInclude });
    if (!p || !canView(user, factsOf(p))) throw notFound("Permit not found.");

    if (p.status === "DRAFT") {
      deny(canEditDraft(user, factsOf(p)));
      const data: Prisma.PermitUncheckedUpdateInput = {};
      if (input.contractor !== undefined) data.contractor = input.contractor;
      if (input.workDescription !== undefined) data.workDescription = input.workDescription;
      if (input.equipmentId !== undefined) {
        await assertEquipmentExists(input.equipmentId);
        data.equipmentId = input.equipmentId;
      }
      if (input.plannedStart !== undefined) data.plannedStart = toDate(input.plannedStart);
      if (input.plannedEnd !== undefined) data.plannedEnd = toDate(input.plannedEnd);
      assertWindow(
        (data.plannedStart as Date | null | undefined) ?? p.plannedStart,
        (data.plannedEnd as Date | null | undefined) ?? p.plannedEnd,
      );
      if (input.hazards) data.hazards = input.hazards;
      if (input.ppe) data.ppe = input.ppe;
      if (input.precautions) data.precautions = input.precautions as Prisma.InputJsonValue;
      if (input.requiredApprovalRoles) data.requiredApprovalRoles = input.requiredApprovalRoles as Role[];
      if (input.typeSpecificData) data.typeSpecificData = validateTypeData(p.permitType, input.typeSpecificData, "draft") as Prisma.InputJsonValue;
      await tx.permit.update({ where: { id }, data });
    } else {
      // After submission only a Safety Officer / Admin may edit, and only safety information of a live permit.
      deny(canEditSubmitted(user));
      if (p.status !== "ACTIVE" && p.status !== "SUSPENDED") {
        throw conflict(
          p.status === "PENDING_APPROVAL" || p.status === "APPROVED"
            ? "A permit under approval cannot be edited. Reject or cancel it and create a new permit."
            : `Permit is ${p.status} and cannot be edited.`,
          "NOT_EDITABLE",
        );
      }
      const forbiddenKeys = Object.keys(input).filter((k) => k !== "comment" && !(SUBMITTED_EDITABLE as readonly string[]).includes(k) && (input as any)[k] !== undefined);
      if (forbiddenKeys.length) {
        throw conflict(`These fields cannot be changed after submission: ${forbiddenKeys.join(", ")}.`, "FIELD_LOCKED");
      }
      const data: Prisma.PermitUncheckedUpdateInput = {};
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      const track = (key: string, from: unknown, to: unknown) => {
        if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
      };
      if (input.workDescription !== undefined) { track("workDescription", p.workDescription, input.workDescription); data.workDescription = input.workDescription; }
      if (input.hazards) { track("hazards", p.hazards, input.hazards); data.hazards = input.hazards; }
      if (input.ppe) { track("ppe", p.ppe, input.ppe); data.ppe = input.ppe; }
      if (input.precautions) { track("precautions", p.precautions, input.precautions); data.precautions = input.precautions as Prisma.InputJsonValue; }
      if (input.typeSpecificData) {
        const merged = { ...(p.typeSpecificData as object), ...input.typeSpecificData };
        const valid = validateTypeData(p.permitType, merged, "full");
        track("typeSpecificData", p.typeSpecificData, valid);
        data.typeSpecificData = valid as Prisma.InputJsonValue;
      }
      if (Object.keys(changes).length === 0) throw badRequest("Nothing to change.");
      await tx.permit.update({ where: { id }, data });
      await writeAudit(tx, {
        permitId: id,
        actor: user,
        action: "FIELDS_EDITED",
        fromStatus: p.status,
        toStatus: p.status,
        changes: changes as Prisma.InputJsonValue,
        comment: input.comment ?? null,
      });
    }
    return tx.permit.findUniqueOrThrow({ where: { id }, include: fullInclude });
  });
  return toView(permit, user, now);
}

/** Conflict warning: HOT_WORK vs CONFINED_SPACE overlapping in time in the same area. */
export async function findConflicts(p: PermitFull) {
  if ((p.permitType !== "HOT_WORK" && p.permitType !== "CONFINED_SPACE") || !p.equipment || !p.plannedStart || !p.plannedEnd) return [];
  const other = p.permitType === "HOT_WORK" ? "CONFINED_SPACE" : "HOT_WORK";
  const rows = await prisma.permit.findMany({
    where: {
      id: { not: p.id },
      permitType: other,
      status: { in: ["PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED"] },
      equipment: { areaId: p.equipment.areaId },
      plannedStart: { lt: p.plannedEnd },
      plannedEnd: { gt: p.plannedStart },
    },
    include: { equipment: true },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    permitType: r.permitType,
    status: r.status,
    equipmentTag: r.equipment?.tag ?? null,
    sameEquipment: r.equipmentId === p.equipmentId,
    plannedStart: r.plannedStart,
    plannedEnd: r.plannedEnd,
  }));
}

export async function getPermit(user: Actor, id: string, now = new Date()) {
  const p = await loadPermitFor(user, id, now);
  const conflicts = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED"].includes(p.status) ? await findConflicts(p) : [];
  return { ...toView(p, user, now), conflicts };
}

export async function listPermits(user: Actor, q: ListQuery, now = new Date()) {
  await expireDuePermits(now);
  const and: Prisma.PermitWhereInput[] = [scopeWhere(user)];
  if (q.status?.length) and.push({ status: { in: q.status as PermitStatus[] } });
  if (q.type?.length) and.push({ permitType: { in: q.type as any[] } });
  if (q.areaId) and.push({ equipment: { areaId: q.areaId } });
  // date range: permit window overlaps [from, to]
  if (q.from) and.push({ plannedEnd: { gte: new Date(q.from) } });
  if (q.to) and.push({ plannedStart: { lte: new Date(q.to) } });
  if (q.activeNow === "true") and.push({ status: "ACTIVE" });
  if (q.expiringSoon === "true") and.push({ status: "ACTIVE", plannedEnd: { gt: now, lte: new Date(now.getTime() + 2 * 3600_000) } });
  if (q.search) {
    const n = Number(q.search.replace(/\D/g, ""));
    and.push({
      OR: [
        { workDescription: { contains: q.search, mode: "insensitive" } },
        { contractor: { contains: q.search, mode: "insensitive" } },
        { equipment: { tag: { contains: q.search, mode: "insensitive" } } },
        ...(Number.isFinite(n) && n > 0 ? [{ number: n }] : []),
      ],
    });
  }
  let rows = await prisma.permit.findMany({ where: { AND: and }, include: fullInclude, orderBy: [{ updatedAt: "desc" }] });
  const views = rows.map((r) => toView(r, user, now));
  return q.pendingMyApproval === "true" ? views.filter((v) => v.status === "PENDING_APPROVAL" && v.allowedActions.includes("approve")) : views;
}

export async function permitStats(user: Actor, now = new Date()) {
  await expireDuePermits(now);
  const rows = await prisma.permit.findMany({
    where: scopeWhere(user),
    include: fullInclude,
  });
  const soon = now.getTime() + 2 * 3600_000;
  const weekAgo = now.getTime() - 7 * 86400_000;
  const count = (f: (r: PermitFull) => boolean) => rows.filter(f).length;
  return {
    active: count((r) => r.status === "ACTIVE"),
    pendingApproval: count((r) => r.status === "PENDING_APPROVAL"),
    expiringSoon: count((r) => r.status === "ACTIVE" && !!r.plannedEnd && r.plannedEnd.getTime() <= soon),
    suspended: count((r) => r.status === "SUSPENDED"),
    draft: count((r) => r.status === "DRAFT"),
    recentlyClosed: count((r) => (r.status === "CLOSED" || r.status === "CLOSED_VERIFIED") && !!r.closedAt && r.closedAt.getTime() >= weekAgo),
    myApprovalsPending: count((r) => r.status === "PENDING_APPROVAL" && toView(r, user, now).allowedActions.includes("approve")),
  };
}

export async function listAudit(user: Actor, id: string, now = new Date()) {
  await loadPermitFor(user, id, now);
  return prisma.auditLog.findMany({ where: { permitId: id }, orderBy: { createdAt: "asc" } });
}

export { getTypeDefinition };
