import { describe, expect, it } from "vitest";
import { PermitStatus } from "@prisma/client";
import { assertTransition, canTransition, isTerminal, nextStatusAfterApproval, PermitAction } from "../src/stateMachine/transitions";

describe("state machine (pure logic, no database)", () => {
  it("DRAFT -> PENDING_APPROVAL on submit", () => {
    expect(assertTransition("submit", "DRAFT")).toBe("PENDING_APPROVAL");
  });

  it("rejects illegal transitions with a 409", () => {
    const tryIt = () => assertTransition("activate", "DRAFT");
    expect(tryIt).toThrowError(/Cannot activate a permit that is DRAFT/);
    try { tryIt(); } catch (e: any) { expect(e.status).toBe(409); }
    expect(canTransition("approve", "ACTIVE")).toBe(false);
    expect(canTransition("submit", "ACTIVE")).toBe(false);
  });

  it("approval: stays pending until ALL approvers approve", () => {
    expect(nextStatusAfterApproval([{ status: "APPROVED" }, { status: "PENDING" }])).toBe("PENDING_APPROVAL");
    expect(nextStatusAfterApproval([{ status: "APPROVED" }, { status: "APPROVED" }])).toBe("APPROVED");
  });

  it("any rejection rejects the permit", () => {
    expect(nextStatusAfterApproval([{ status: "APPROVED" }, { status: "REJECTED" }])).toBe("REJECTED");
    expect(assertTransition("reject", "PENDING_APPROVAL")).toBe("REJECTED");
  });

  it("APPROVED -> ACTIVE, ACTIVE <-> SUSPENDED", () => {
    expect(assertTransition("activate", "APPROVED")).toBe("ACTIVE");
    expect(assertTransition("suspend", "ACTIVE")).toBe("SUSPENDED");
    expect(assertTransition("resume", "SUSPENDED")).toBe("ACTIVE");
  });

  it("closure path: ACTIVE -> CLOSED -> CLOSED_VERIFIED", () => {
    expect(assertTransition("complete", "ACTIVE")).toBe("CLOSED");
    expect(assertTransition("verify", "CLOSED")).toBe("CLOSED_VERIFIED");
    expect(canTransition("verify", "ACTIVE")).toBe(false);
  });

  it("expiry applies to APPROVED, ACTIVE and SUSPENDED only", () => {
    for (const s of ["APPROVED", "ACTIVE", "SUSPENDED"] as PermitStatus[]) expect(assertTransition("expire", s)).toBe("EXPIRED");
    expect(canTransition("expire", "DRAFT")).toBe(false);
    expect(canTransition("expire", "CLOSED")).toBe(false);
  });

  it("an EXPIRED permit can never be reactivated (or resumed, or anything else)", () => {
    const actions: PermitAction[] = ["submit", "approve", "reject", "activate", "suspend", "resume", "complete", "verify", "cancel"];
    for (const a of actions) {
      expect(() => assertTransition(a, "EXPIRED")).toThrowError(/Expired permits cannot be reactivated/);
    }
  });

  it("cancellation works from every live state and from no terminal state", () => {
    for (const s of ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED"] as PermitStatus[]) {
      expect(assertTransition("cancel", s)).toBe("CANCELLED");
    }
    for (const s of ["REJECTED", "EXPIRED", "CLOSED_VERIFIED", "CANCELLED"] as PermitStatus[]) {
      expect(isTerminal(s)).toBe(true);
      expect(() => assertTransition("cancel", s)).toThrow();
    }
  });
});
