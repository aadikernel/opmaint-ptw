import { PermitStatus } from "@prisma/client";
import { conflict } from "../utils/errors";

export type PermitAction =
  | "submit" | "approve" | "reject" | "activate" | "suspend"
  | "resume" | "expire" | "complete" | "verify" | "cancel";

/**
 * The ONLY place that says which status changes are legal.
 * Pure data + pure functions, no database, so it is easy to test.
 * `approve` stays in PENDING_APPROVAL until the last approver approves (see nextStatusAfterApproval).
 */
export const TRANSITIONS: Record<PermitAction, { from: PermitStatus[]; to: PermitStatus }> = {
  submit:   { from: ["DRAFT"], to: "PENDING_APPROVAL" },
  approve:  { from: ["PENDING_APPROVAL"], to: "APPROVED" },
  reject:   { from: ["PENDING_APPROVAL"], to: "REJECTED" },
  activate: { from: ["APPROVED"], to: "ACTIVE" },
  suspend:  { from: ["ACTIVE"], to: "SUSPENDED" },
  resume:   { from: ["SUSPENDED"], to: "ACTIVE" },
  expire:   { from: ["APPROVED", "ACTIVE", "SUSPENDED"], to: "EXPIRED" },
  complete: { from: ["ACTIVE"], to: "CLOSED" },
  verify:   { from: ["CLOSED"], to: "CLOSED_VERIFIED" },
  // CLOSED is left out on purpose: finished work must be verified, not cancelled.
  cancel:   { from: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED"], to: "CANCELLED" },
};

export const TERMINAL_STATUSES: PermitStatus[] = ["REJECTED", "EXPIRED", "CLOSED_VERIFIED", "CANCELLED"];

export const isTerminal = (s: PermitStatus) => TERMINAL_STATUSES.includes(s);

export function canTransition(action: PermitAction, from: PermitStatus): boolean {
  return TRANSITIONS[action].from.includes(from);
}

/** Throws a 409 with a clear message if the action is not legal from the current status. */
export function assertTransition(action: PermitAction, from: PermitStatus): PermitStatus {
  if (canTransition(action, from)) return TRANSITIONS[action].to;
  if (from === "EXPIRED") {
    throw conflict("Expired permits cannot be reactivated. Create a new permit.", "PERMIT_EXPIRED");
  }
  if (isTerminal(from)) {
    throw conflict(`Permit is ${from} and cannot be changed any more.`, "PERMIT_TERMINAL");
  }
  throw conflict(`Cannot ${action} a permit that is ${from}.`, "ILLEGAL_TRANSITION");
}

export function nextStatusAfterApproval(approvals: { status: "PENDING" | "APPROVED" | "REJECTED" }[]): PermitStatus {
  if (approvals.some((a) => a.status === "REJECTED")) return "REJECTED";
  if (approvals.length > 0 && approvals.every((a) => a.status === "APPROVED")) return "APPROVED";
  return "PENDING_APPROVAL";
}
