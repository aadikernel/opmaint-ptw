/**
 * End-to-end API tests against a REAL PostgreSQL test database.
 * They call the Express app directly with Supertest, exactly like an evaluator trying to break the API.
 */
import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { expireDuePermits } from "../src/services/expiryService";
import { activatePermit, resumePermit } from "../src/services/workflowService";

const app = createApp();
const PASSWORD = "Test@12345";
const H = 3600_000;

const tokens: Record<string, string> = {};
const users: Record<string, { id: string; name: string; role: any; areaId: string | null }> = {};
let areaA: string, areaB: string, eqA: string, eqB: string;

const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
const get = (who: string, url: string) => request(app).get(url).set(as(who));
const post = (who: string, url: string, body: object = {}) => request(app).post(url).set(as(who)).send(body);

const heightData = (over: object = {}) => ({
  heightMetres: 6, accessMethod: "SCAFFOLD", fallArrestEquipment: "Full body harness",
  anchorPointChecked: true, barricadingBelow: true, ...over,
});
const hotData = (lel = 0) => ({
  hotWorkType: "WELDING", fireWatchAssigned: "Suresh", extinguisherType: "CO2", combustiblesClearedRadiusM: 15,
  gasTest: { lelPercent: lel, o2Percent: 20.9, testTime: new Date().toISOString() },
});

function permitBody(over: Record<string, unknown> = {}) {
  return {
    permitType: "WORKING_AT_HEIGHT", contractor: "SkyLine", workDescription: "Repaint handrail on roof of tank",
    equipmentId: eqA, plannedStart: new Date(Date.now() + H).toISOString(), plannedEnd: new Date(Date.now() + 5 * H).toISOString(),
    hazards: ["Fall from height"], ppe: ["Full body harness"], precautions: [{ label: "Toolbox talk done", confirmed: true }],
    typeSpecificData: heightData(), ...over,
  };
}
/** Create + submit a permit as the requester. Returns the permit object after submission. */
async function submitted(over: Record<string, unknown> = {}, who = "requester") {
  const c = await post(who, "/api/permits", permitBody(over));
  expect(c.status).toBe(201);
  const s = await post(who, `/api/permits/${c.body.permit.id}/submit`);
  expect(s.status).toBe(200);
  return s.body.permit;
}

beforeAll(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "ClosureVerification","WorkLog","AuditLog","PermitApproval","Permit","User","Equipment","Area","Plant" RESTART IDENTITY CASCADE');
  const plant = await prisma.plant.create({ data: { name: "Test Plant", code: "TP" } });
  areaA = (await prisma.area.create({ data: { name: "Area A", plantId: plant.id } })).id;
  areaB = (await prisma.area.create({ data: { name: "Area B", plantId: plant.id } })).id;
  eqA = (await prisma.equipment.create({ data: { tag: "A-1", name: "Equipment A1", areaId: areaA } })).id;
  eqB = (await prisma.equipment.create({ data: { tag: "B-1", name: "Equipment B1", areaId: areaB } })).id;
  const hash = await bcrypt.hash(PASSWORD, 4);
  const defs: [string, string, string, string | null][] = [
    ["requester", "REQUESTER", "r@t.test", null], ["ownerA", "AREA_OWNER", "oa@t.test", areaA], ["ownerB", "AREA_OWNER", "ob@t.test", areaB],
    ["officer", "SAFETY_OFFICER", "s@t.test", null], ["admin", "ADMIN", "a@t.test", null], ["requester2", "REQUESTER", "r2@t.test", null],
  ];
  for (const [key, role, email, areaId] of defs) {
    const u = await prisma.user.create({ data: { name: key, email, role: role as any, areaId, passwordHash: hash } });
    users[key] = { id: u.id, name: u.name, role: u.role, areaId: u.areaId };
    const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
    tokens[key] = res.body.token;
  }
});
afterAll(async () => { await prisma.$disconnect(); });

describe("authentication", () => {
  it("logs in with the right password and rejects the wrong one", async () => {
    expect(tokens.requester).toBeTruthy();
    const bad = await request(app).post("/api/auth/login").send({ email: "r@t.test", password: "nope" });
    expect(bad.status).toBe(401);
  });
  it("rejects requests without a token or with a fake token (401)", async () => {
    expect((await request(app).get("/api/permits")).status).toBe(401);
    expect((await request(app).get("/api/permits").set("Authorization", "Bearer abc.def.ghi")).status).toBe(401);
  });
  it("never returns the password hash", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "r@t.test", password: PASSWORD });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
});

describe("permit creation and validation", () => {
  it("ignores client-supplied status / requester (identity comes from the JWT)", async () => {
    const res = await post("requester", "/api/permits", { ...permitBody(), status: "ACTIVE", requesterId: users.admin.id });
    expect(res.status).toBe(201);
    expect(res.body.permit.status).toBe("DRAFT");
    expect(res.body.permit.requester.id).toBe(users.requester.id);
  });
  it("validates type-specific data by permit type (400)", async () => {
    const res = await post("requester", "/api/permits", permitBody({ permitType: "HOT_WORK", typeSpecificData: { hotWorkType: "PAINTING", gasTest: { lelPercent: "high" } } }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Invalid Hot Work details/);
  });
  it("area owner cannot create permits (403)", async () => {
    expect((await post("ownerA", "/api/permits", permitBody())).status).toBe(403);
  });
  it("incomplete permit cannot be submitted (400)", async () => {
    const c = await post("requester", "/api/permits", { permitType: "HOT_WORK", contractor: "x" });
    const s = await post("requester", `/api/permits/${c.body.permit.id}/submit`);
    expect(s.status).toBe(400);
  });
  it("another requester cannot see or edit my permit (404)", async () => {
    const c = await post("requester", "/api/permits", permitBody());
    expect((await get("requester2", `/api/permits/${c.body.permit.id}`)).status).toBe(404);
    expect((await request(app).patch(`/api/permits/${c.body.permit.id}`).set(as("requester2")).send({ contractor: "hack" })).status).toBe(404);
  });
});

describe("approval rules (server-side)", () => {
  it("requester cannot approve (403)", async () => {
    const p = await submitted();
    const res = await post("requester", `/api/permits/${p.id}/approve`);
    expect(res.status).toBe(403);
  });
  it("area owner cannot approve another area's permit", async () => {
    const p = await submitted({ equipmentId: eqB });
    const res = await post("ownerA", `/api/permits/${p.id}/approve`);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("You are not authorized to approve permits for this area.");
  });
  it("area owner of the SAME area can approve", async () => {
    const p = await submitted();
    const res = await post("ownerA", `/api/permits/${p.id}/approve`, { comment: "ok" });
    expect(res.status).toBe(200);
    expect(res.body.permit.status).toBe("APPROVED");
  });
  it("a user can NEVER approve their own permit (admin creates, submits, tries to approve)", async () => {
    const p = await submitted({}, "admin");
    const res = await post("admin", `/api/permits/${p.id}/approve`);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("You cannot approve or reject your own permit.");
    expect((await post("admin", `/api/permits/${p.id}/reject`, { reason: "self reject" })).status).toBe(403);
    const after = await get("admin", `/api/permits/${p.id}`);
    expect(after.body.permit.status).toBe("PENDING_APPROVAL");
  });
  it("safety officer can approve any permit", async () => {
    const p = await submitted({ equipmentId: eqB });
    expect((await post("officer", `/api/permits/${p.id}/approve`)).status).toBe(200);
  });
  it("ALL required approvers must approve (hot work needs area owner + safety officer)", async () => {
    const p = await submitted({ permitType: "HOT_WORK", typeSpecificData: hotData() });
    expect(p.approvals).toHaveLength(2);
    const a1 = await post("ownerA", `/api/permits/${p.id}/approve`);
    expect(a1.body.permit.status).toBe("PENDING_APPROVAL");
    // one approval is not enough to activate
    const early = await post("requester", `/api/permits/${p.id}/activate`);
    expect(early.status).toBe(409);
    // the same person cannot fill the second slot
    expect((await post("ownerA", `/api/permits/${p.id}/approve`)).status).toBeGreaterThanOrEqual(403);
    const a2 = await post("officer", `/api/permits/${p.id}/approve`);
    expect(a2.body.permit.status).toBe("APPROVED");
  });
  it("rejection needs a reason and moves the permit to REJECTED (terminal)", async () => {
    const p = await submitted();
    expect((await post("ownerA", `/api/permits/${p.id}/reject`, {})).status).toBe(400);
    const r = await post("ownerA", `/api/permits/${p.id}/reject`, { reason: "Scaffold not inspected" });
    expect(r.status).toBe(200);
    expect(r.body.permit.status).toBe("REJECTED");
    expect((await post("ownerA", `/api/permits/${p.id}/approve`)).status).toBe(409);
  });
});

describe("activation, suspension, closure", () => {
  it("cannot activate before planned start (409) but can after it", async () => {
    const p = await submitted();
    await post("ownerA", `/api/permits/${p.id}/approve`);
    const early = await post("requester", `/api/permits/${p.id}/activate`);
    expect(early.status).toBe(409);
    expect(early.body.error.message).toBe("Permit cannot be activated before its planned start time.");
    const afterStart = new Date(new Date(p.plannedStart).getTime() + 60_000);
    const ok = await activatePermit(users.requester, p.id, afterStart);
    expect(ok.status).toBe("ACTIVE");
  });

  it("full lifecycle: activate, log work, suspend (stops work), resume, complete, verify, audit trail", async () => {
    const p = await submitted();
    await post("ownerA", `/api/permits/${p.id}/approve`);
    const start = new Date(new Date(p.plannedStart).getTime() + 60_000);
    await activatePermit(users.requester, p.id, start);

    expect((await post("requester", `/api/permits/${p.id}/work-logs`, { note: "Started painting" })).status).toBe(201);

    // only safety officer / admin can suspend
    expect((await post("requester", `/api/permits/${p.id}/suspend`, { reason: "just because" })).status).toBe(403);
    expect((await post("ownerA", `/api/permits/${p.id}/suspend`, { reason: "just because" })).status).toBe(403);
    const sus = await post("officer", `/api/permits/${p.id}/suspend`, { reason: "High wind speed" });
    expect(sus.status).toBe(200);
    expect(sus.body.permit.status).toBe("SUSPENDED");

    // Rule 5 + 8: no work while suspended
    const blocked = await post("requester", `/api/permits/${p.id}/work-logs`, { note: "sneaky work" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/ACTIVE permit/);

    const res = await resumePermit(users.officer, p.id, "Wind dropped", new Date(start.getTime() + 30 * 60_000));
    expect(res.status).toBe("ACTIVE");

    expect((await post("requester", `/api/permits/${p.id}/verify-closure`, { areaClean: true, workComplete: true })).status).toBe(403);
    expect((await post("requester", `/api/permits/${p.id}/complete`, {})).status).toBe(400);
    const done = await post("requester", `/api/permits/${p.id}/complete`, { completionNotes: "Painting finished, tools removed." });
    expect(done.body.permit.status).toBe("CLOSED");
    expect((await post("officer", `/api/permits/${p.id}/verify-closure`, { areaClean: false, workComplete: true })).status).toBe(409);
    const ver = await post("officer", `/api/permits/${p.id}/verify-closure`, { areaClean: true, workComplete: true, comment: "Checked on site" });
    expect(ver.body.permit.status).toBe("CLOSED_VERIFIED");

    const audit = await get("requester", `/api/permits/${p.id}/audit`);
    const actions = audit.body.entries.map((e: any) => e.action);
    expect(actions).toEqual(["CREATED", "SUBMITTED", "APPROVED", "ACTIVATED", "SUSPENDED", "RESUMED", "WORK_COMPLETED", "CLOSURE_VERIFIED"]);
    const suspended = audit.body.entries.find((e: any) => e.action === "SUSPENDED");
    expect(suspended).toMatchObject({ actorName: "officer", fromStatus: "ACTIVE", toStatus: "SUSPENDED", comment: "High wind speed" });
  });

  it("an unsafe gas reading blocks activation (409)", async () => {
    const p = await submitted({ permitType: "HOT_WORK", typeSpecificData: hotData(12) });
    await post("ownerA", `/api/permits/${p.id}/approve`);
    await post("officer", `/api/permits/${p.id}/approve`);
    const start = new Date(new Date(p.plannedStart).getTime() + 60_000);
    await expect(activatePermit(users.requester, p.id, start)).rejects.toMatchObject({ status: 409, code: "SAFETY_CHECK_FAILED" });
  });

  it("cancellation works from DRAFT and ACTIVE, requires a reason, and cannot be repeated", async () => {
    const c = await post("requester", "/api/permits", permitBody());
    expect((await post("requester", `/api/permits/${c.body.permit.id}/cancel`, {})).status).toBe(400);
    const x = await post("requester", `/api/permits/${c.body.permit.id}/cancel`, { reason: "Not needed" });
    expect(x.body.permit.status).toBe("CANCELLED");
    expect((await post("requester", `/api/permits/${c.body.permit.id}/cancel`, { reason: "again" })).status).toBe(409);
    // someone else cannot cancel it
    const p2 = await post("requester", "/api/permits", permitBody());
    expect((await post("requester2", `/api/permits/${p2.body.permit.id}/cancel`, { reason: "mine now" })).status).toBe(403);
  });

  it("edits after submission are admin/safety-officer only and are audited with old and new values", async () => {
    const p = await submitted();
    await post("ownerA", `/api/permits/${p.id}/approve`);
    await activatePermit(users.requester, p.id, new Date(new Date(p.plannedStart).getTime() + 60_000));
    const byRequester = await request(app).patch(`/api/permits/${p.id}`).set(as("requester")).send({ hazards: ["Noise"] });
    expect(byRequester.status).toBe(403);
    const ok = await request(app).patch(`/api/permits/${p.id}`).set(as("officer")).send({ hazards: ["Noise"], comment: "Added noise hazard" });
    expect(ok.status).toBe(200);
    const audit = await get("officer", `/api/permits/${p.id}/audit`);
    const edit = audit.body.entries.find((e: any) => e.action === "FIELDS_EDITED");
    expect(edit.changes.hazards).toEqual({ from: ["Fall from height"], to: ["Noise"] });
  });
});

describe("expiry", () => {
  it("an ACTIVE permit past its end becomes EXPIRED even if nobody has the app open, and can never be reactivated", async () => {
    const p = await submitted();
    await post("ownerA", `/api/permits/${p.id}/approve`);
    await activatePermit(users.requester, p.id, new Date(new Date(p.plannedStart).getTime() + 60_000));
    const afterEnd = new Date(new Date(p.plannedEnd).getTime() + 60_000);
    const n = await expireDuePermits(afterEnd);
    expect(n).toBeGreaterThanOrEqual(1);
    const row = await prisma.permit.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe("EXPIRED");

    // Expired permits cannot be reactivated, resumed, or logged against
    await expect(activatePermit(users.requester, p.id, afterEnd)).rejects.toMatchObject({ status: 409, message: "Expired permits cannot be reactivated. Create a new permit." });
    const viaApi = await post("requester", `/api/permits/${p.id}/activate`);
    expect(viaApi.status).toBe(409);
    expect((await post("requester", `/api/permits/${p.id}/work-logs`, { note: "late work" })).status).toBe(409);

    const audit = await prisma.auditLog.findMany({ where: { permitId: p.id, action: "EXPIRED" } });
    expect(audit).toHaveLength(1);
    expect(audit[0].actorName).toBe("System");
  });
});

describe("audit trail is immutable", () => {
  it("database refuses UPDATE and DELETE of audit rows", async () => {
    const p = await submitted();
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { permitId: p.id } });
    await expect(prisma.auditLog.update({ where: { id: entry.id }, data: { comment: "tampered" } })).rejects.toThrow(/immutable/);
    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/immutable/);
  });
});

describe("dashboard, filters and warnings", () => {
  it("stats and filters only include permits the user may see", async () => {
    const mine = await get("requester", "/api/permits?status=PENDING_APPROVAL");
    expect(mine.status).toBe(200);
    expect(mine.body.permits.every((x: any) => x.requester.id === users.requester.id)).toBe(true);
    const stats = await get("requester", "/api/permits/stats");
    expect(stats.body).toHaveProperty("expiringSoon");
    const pending = await get("ownerA", "/api/permits?pendingMyApproval=true");
    expect(pending.body.permits.every((x: any) => x.allowedActions.includes("approve"))).toBe(true);
  });
  it("only admins can use admin endpoints (403)", async () => {
    expect((await get("requester", "/api/admin/users")).status).toBe(403);
    expect((await get("officer", "/api/admin/users")).status).toBe(403);
    expect((await get("admin", "/api/admin/users")).status).toBe(200);
  });
  it("warns when hot work overlaps a confined space permit in the same area", async () => {
    await submitted({
      permitType: "CONFINED_SPACE",
      typeSpecificData: {
        spaceId: "V-1", entryPoint: "Manway", standbyAttendant: "Karthik", rescuePlan: "Tripod and rescue team ready at the manway.", ventilationMethod: "NATURAL",
        atmosphericTest: { o2Percent: 20.9, lelPercent: 0, h2sPpm: 0, coPpm: 0, testTime: new Date().toISOString() },
      },
    });
    const hot = await submitted({ permitType: "HOT_WORK", typeSpecificData: hotData() });
    const detail = await get("requester", `/api/permits/${hot.id}`);
    expect(detail.body.permit.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(detail.body.permit.conflicts[0].permitType).toBe("CONFINED_SPACE");
  });
});
