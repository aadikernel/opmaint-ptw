import { Prisma, PermitStatus } from "@prisma/client";
import { Actor } from "../policies/permitPolicy";

export interface AuditInput {
  permitId: string;
  actor: Actor | null; // null = the system (e.g. automatic expiry)
  action: string;
  fromStatus?: PermitStatus | null;
  toStatus?: PermitStatus | null;
  changes?: Prisma.InputJsonValue;
  comment?: string | null;
}

/** Audit rows are insert-only. A database trigger also blocks UPDATE and DELETE. */
export function writeAudit(tx: Prisma.TransactionClient, a: AuditInput) {
  return tx.auditLog.create({
    data: {
      permitId: a.permitId,
      actorId: a.actor?.id ?? null,
      actorName: a.actor?.name ?? "System",
      action: a.action,
      fromStatus: a.fromStatus ?? null,
      toStatus: a.toStatus ?? null,
      changes: a.changes,
      comment: a.comment ?? null,
    },
  });
}
