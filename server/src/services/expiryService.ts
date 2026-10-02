import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { writeAudit } from "./auditService";

const EXPIRABLE = ["APPROVED", "ACTIVE", "SUSPENDED"] as const;

/**
 * Moves every permit whose window has passed to EXPIRED and writes an audit entry.
 * Called by the cron job AND lazily before reads/writes, so a permit can never be used after its end time
 * even if the scheduler was asleep (e.g. free-tier hosting).
 */
export async function expireDuePermits(now: Date = new Date(), client?: Prisma.TransactionClient): Promise<number> {
  const run = async (tx: Prisma.TransactionClient) => {
    const due = await tx.permit.findMany({
      where: { status: { in: [...EXPIRABLE] }, plannedEnd: { lt: now } },
      select: { id: true, status: true },
    });
    let count = 0;
    for (const p of due) {
      // The status filter makes this safe if two processes race: only one update matches.
      const res = await tx.permit.updateMany({ where: { id: p.id, status: p.status }, data: { status: "EXPIRED" } });
      if (res.count === 1) {
        await writeAudit(tx, {
          permitId: p.id,
          actor: null,
          action: "EXPIRED",
          fromStatus: p.status,
          toStatus: "EXPIRED",
          comment: "Validity window ended. The permit can no longer be used.",
        });
        count++;
      }
    }
    return count;
  };
  return client ? run(client) : prisma.$transaction(run);
}
