import { describe, expect, it } from "vitest";
import { Actor, PermitFacts, canApprove, canSuspend, canView, canVerify, canCreate } from "../src/policies/permitPolicy";

const mk = (role: Actor["role"], id: string = role, areaId: string | null = null): Actor => ({ id, name: id, role, areaId });
const permit = (requesterId: string, areaId = "area-1"): PermitFacts => ({ requesterId, areaId, status: "PENDING_APPROVAL" });

describe("permission policies (pure logic, no database)", () => {
  it("requester cannot approve", () => {
    expect(canApprove(mk("REQUESTER", "r1"), permit("someone-else"))).toMatch(/not allowed to approve/);
  });

  it("area owner can approve in their own area only", () => {
    const owner = mk("AREA_OWNER", "o1", "area-1");
    expect(canApprove(owner, permit("r1", "area-1"))).toBeNull();
    expect(canApprove(owner, permit("r1", "area-2"))).toBe("You are not authorized to approve permits for this area.");
  });

  it("NOBODY can approve their own permit, whatever their role", () => {
    for (const role of ["REQUESTER", "AREA_OWNER", "SAFETY_OFFICER", "ADMIN"] as const) {
      const u = mk(role, "same-person", "area-1");
      expect(canApprove(u, permit("same-person", "area-1"))).toBe("You cannot approve or reject your own permit.");
    }
  });

  it("safety officer can approve any permit and suspend", () => {
    const so = mk("SAFETY_OFFICER", "s1");
    expect(canApprove(so, permit("r1", "area-9"))).toBeNull();
    expect(canSuspend(so)).toBeNull();
  });

  it("requester and area owner cannot suspend", () => {
    expect(canSuspend(mk("REQUESTER"))).not.toBeNull();
    expect(canSuspend(mk("AREA_OWNER", "o1", "area-1"))).not.toBeNull();
  });

  it("safety officer cannot verify closure of their own permit", () => {
    expect(canVerify(mk("SAFETY_OFFICER", "x"), permit("x"))).toMatch(/own permit/);
    expect(canVerify(mk("SAFETY_OFFICER", "x"), permit("y"))).toBeNull();
  });

  it("only requesters and admins create permits", () => {
    expect(canCreate(mk("REQUESTER"))).toBeNull();
    expect(canCreate(mk("AREA_OWNER"))).not.toBeNull();
  });

  it("area owners cannot see other areas or other people's drafts", () => {
    const owner = mk("AREA_OWNER", "o1", "area-1");
    expect(canView(owner, { requesterId: "r", areaId: "area-2", status: "ACTIVE" })).toBe(false);
    expect(canView(owner, { requesterId: "r", areaId: "area-1", status: "DRAFT" })).toBe(false);
    expect(canView(owner, { requesterId: "r", areaId: "area-1", status: "ACTIVE" })).toBe(true);
  });
});
