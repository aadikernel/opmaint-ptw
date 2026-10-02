/**
 * Seed data: 4 users, 2 plants, 4 areas, 6 equipment, 12 permits spread over every status.
 * Run:  npm run db:seed      (safe to re-run: it wipes and recreates the data)
 * Times are relative to "now", so ACTIVE permits are really active when you open the app.
 */
import bcrypt from "bcryptjs";
import { PermitStatus, PermitType, Prisma, PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

export const DEMO_PASSWORD = "Ptw@12345";
const NOW = Date.now();
const at = (minutes: number) => new Date(NOW + minutes * 60_000);
const iso = (minutes: number) => at(minutes).toISOString();

// ---- sample type-specific data (valid against the Zod schemas) ----
const hot = (radius = 15) => ({
  hotWorkType: "WELDING", fireWatchAssigned: "Suresh Kumar", extinguisherType: "ABC_DRY_POWDER",
  combustiblesClearedRadiusM: radius, gasTest: { lelPercent: 0, o2Percent: 20.9, testTime: iso(-30) },
});
const confined = () => ({
  spaceId: "RX-301-VESSEL", entryPoint: "Top manway M1",
  atmosphericTest: { o2Percent: 20.8, lelPercent: 0, h2sPpm: 0, coPpm: 2, testTime: iso(-20) },
  standbyAttendant: "Karthik R", rescuePlan: "Tripod and winch at M1, SCBA team on standby at muster point B.",
  ventilationMethod: "MECHANICAL_FORCED",
});
const height = (anchor = true, barricade = true) => ({
  heightMetres: 9, accessMethod: "SCAFFOLD", fallArrestEquipment: "Full body harness with twin lanyard",
  anchorPointChecked: anchor, barricadingBelow: barricade,
});
const loto = () => ({
  equipmentTag: "TRF-401", voltageLevel: "MV_1_TO_33KV",
  isolationPoints: [
    { description: "11kV incomer breaker", lockNumber: "L-1042", tagNumber: "T-2210" },
    { description: "Transformer LV breaker", lockNumber: "L-1043", tagNumber: "T-2211" },
  ],
  earthingApplied: true, testedDeadBy: "Anil Joshi",
});

async function main() {
  // TRUNCATE does not fire the audit-log row triggers, so it can reset everything.
  await prisma.$executeRawUnsafe(
    'TRUNCATE "ClosureVerification","WorkLog","AuditLog","PermitApproval","Permit","User","Equipment","Area","Plant" RESTART IDENTITY CASCADE',
  );

  const plantA = await prisma.plant.create({ data: { name: "Riverside Refinery", code: "RSR" } });
  const plantB = await prisma.plant.create({ data: { name: "Harbor Chemical Works", code: "HCW" } });
  const pipeRack = await prisma.area.create({ data: { name: "Pipe Rack Area", plantId: plantA.id } });
  const tankFarm = await prisma.area.create({ data: { name: "Tank Farm", plantId: plantA.id } });
  const reactorHall = await prisma.area.create({ data: { name: "Reactor Hall", plantId: plantB.id } });
  const utilities = await prisma.area.create({ data: { name: "Utilities Block", plantId: plantB.id } });

  const eq = async (tag: string, name: string, areaId: string) => prisma.equipment.create({ data: { tag, name, areaId } });
  const prk = await eq("PRK-101", "Main Pipe Rack", pipeRack.id);
  const pmp = await eq("PMP-114", "Crude Feed Pump", pipeRack.id);
  const tnk = await eq("TNK-201", "Storage Tank T-201", tankFarm.id);
  const rx = await eq("RX-301", "Reactor R-301", reactorHall.id);
  const trf = await eq("TRF-401", "Transformer TR-4", utilities.id);
  const ct = await eq("CT-410", "Cooling Tower CT-1", utilities.id);

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = (name: string, email: string, role: Role, areaId: string | null = null) =>
    prisma.user.create({ data: { name, email, role, areaId, passwordHash: hash } });
  const requester = await user("Rahul Verma", "requester@opmaint.test", "REQUESTER");
  const owner = await user("Meera Iyer", "areaowner@opmaint.test", "AREA_OWNER", pipeRack.id);
  const officer = await user("Priya Nair", "safety@opmaint.test", "SAFETY_OFFICER");
  const admin = await user("Arjun Admin", "admin@opmaint.test", "ADMIN");

  type U = typeof requester;
  type Step = { action: string; by: U | null; minsAgo: number; to: PermitStatus; comment?: string };
  interface Spec {
    type: PermitType; status: PermitStatus; equipmentId: string; contractor: string; desc: string;
    start: number; end: number; hazards: string[]; ppe: string[]; data: object;
    roles: Role[]; approvals: { role: Role; by: U; status: "APPROVED" | "REJECTED" | "PENDING"; comment?: string; minsAgo: number }[];
    steps: Step[]; precautions?: string[]; completionNotes?: string; closedMinsAgo?: number;
  }
  const checklist = (items: string[]) => items.map((label) => ({ label, confirmed: true }));
  const generic = ["Toolbox talk completed with all workers", "Work area barricaded and signed"];

  async function make(s: Spec) {
    const created = await prisma.permit.create({
      data: {
        permitType: s.type, status: s.status, requesterId: requester.id, equipmentId: s.equipmentId,
        contractor: s.contractor, workDescription: s.desc, plannedStart: at(s.start), plannedEnd: at(s.end),
        hazards: s.hazards, ppe: s.ppe, precautions: checklist(s.precautions ?? generic) as Prisma.InputJsonValue,
        requiredApprovalRoles: s.roles, typeSpecificData: s.data as Prisma.InputJsonValue,
        submittedAt: s.status === "DRAFT" ? null : at(-300),
        activatedAt: ["ACTIVE", "SUSPENDED", "CLOSED", "CLOSED_VERIFIED"].includes(s.status) ? at(Math.min(s.start, 0) + 5) : null,
        completionNotes: s.completionNotes ?? null,
        closedAt: s.closedMinsAgo !== undefined ? at(-s.closedMinsAgo) : null,
      },
    });
    for (const a of s.approvals) {
      await prisma.permitApproval.create({
        data: {
          permitId: created.id, requiredRole: a.role, approverId: a.status === "PENDING" ? null : a.by.id,
          status: a.status, comment: a.comment ?? null, decidedAt: a.status === "PENDING" ? null : at(-a.minsAgo),
        },
      });
    }
    let from: PermitStatus | null = null;
    for (const st of s.steps) {
      await prisma.auditLog.create({
        data: {
          permitId: created.id, actorId: st.by?.id ?? null, actorName: st.by?.name ?? "System",
          action: st.action, fromStatus: from, toStatus: st.to, comment: st.comment ?? null, createdAt: at(-st.minsAgo),
        },
      });
      from = st.to;
    }
    return created;
  }

  const R = requester, O = owner, S = officer, A = admin;

  // 1. DRAFT (incomplete on purpose)
  await make({
    type: "HOT_WORK", status: "DRAFT", equipmentId: prk.id, contractor: "Apex Fabrication", desc: "Weld bracket onto pipe rack support",
    start: 600, end: 840, hazards: ["Fire / explosion"], ppe: [], roles: [], approvals: [],
    data: { hotWorkType: "WELDING" }, steps: [{ action: "CREATED", by: R, minsAgo: 20, to: "DRAFT", comment: "Draft permit created." }],
  });
  // 2. PENDING (area owner can approve: Pipe Rack Area)
  await make({
    type: "ELECTRICAL_LOTO", status: "PENDING_APPROVAL", equipmentId: pmp.id, contractor: "VoltEdge Electricals", desc: "Replace motor starter contactor on crude feed pump",
    start: 120, end: 480, hazards: ["Electric shock", "Stored energy"], ppe: ["Insulated gloves", "Safety glasses", "Hard hat"],
    data: { ...loto(), equipmentTag: "PMP-114" }, roles: ["AREA_OWNER"], approvals: [{ role: "AREA_OWNER", by: O, status: "PENDING", minsAgo: 0 }],
    steps: [
      { action: "CREATED", by: R, minsAgo: 90, to: "DRAFT", comment: "Draft permit created." },
      { action: "SUBMITTED", by: R, minsAgo: 80, to: "PENDING_APPROVAL", comment: "Approvals required: AREA_OWNER" },
    ],
  });
  // 3. PENDING hot work in Reactor Hall: overlaps the active confined space permit (conflict warning demo)
  await make({
    type: "HOT_WORK", status: "PENDING_APPROVAL", equipmentId: rx.id, contractor: "Apex Fabrication", desc: "Cut and re-weld drain line near reactor R-301",
    start: 60, end: 300, hazards: ["Fire / explosion", "Flammable vapours", "Hot surfaces"], ppe: ["Face shield / welding mask", "Flame-retardant coverall", "Leather gloves", "Safety boots"],
    data: hot(), roles: ["AREA_OWNER", "SAFETY_OFFICER"],
    approvals: [{ role: "AREA_OWNER", by: A, status: "PENDING", minsAgo: 0 }, { role: "SAFETY_OFFICER", by: S, status: "PENDING", minsAgo: 0 }],
    steps: [
      { action: "CREATED", by: R, minsAgo: 60, to: "DRAFT", comment: "Draft permit created." },
      { action: "SUBMITTED", by: R, minsAgo: 50, to: "PENDING_APPROVAL", comment: "Approvals required: AREA_OWNER, SAFETY_OFFICER" },
    ],
  });
  // 4. APPROVED and start time already reached: ready to activate
  await make({
    type: "WORKING_AT_HEIGHT", status: "APPROVED", equipmentId: tnk.id, contractor: "SkyLine Scaffolders", desc: "Inspect and repaint roof handrail on tank T-201",
    start: -10, end: 360, hazards: ["Fall from height", "Falling objects"], ppe: ["Full body harness", "Hard hat", "Safety boots"],
    data: height(), roles: ["AREA_OWNER"], approvals: [{ role: "AREA_OWNER", by: S, status: "APPROVED", comment: "Scaffold tag checked.", minsAgo: 40 }],
    steps: [
      { action: "CREATED", by: R, minsAgo: 200, to: "DRAFT", comment: "Draft permit created." },
      { action: "SUBMITTED", by: R, minsAgo: 190, to: "PENDING_APPROVAL", comment: "Approvals required: AREA_OWNER" },
      { action: "APPROVED", by: S, minsAgo: 40, to: "APPROVED", comment: "Scaffold tag checked." },
    ],
  });
  // 5. ACTIVE hot work
  await make({
    type: "HOT_WORK", status: "ACTIVE", equipmentId: prk.id, contractor: "Apex Fabrication", desc: "Weld new support bracket onto pipe rack PRK-101",
    start: -120, end: 360, hazards: ["Fire / explosion", "Hot surfaces"], ppe: ["Face shield / welding mask", "Flame-retardant coverall", "Leather gloves"],
    data: hot(), roles: ["AREA_OWNER", "SAFETY_OFFICER"],
    approvals: [{ role: "AREA_OWNER", by: O, status: "APPROVED", comment: "Area cleared.", minsAgo: 200 }, { role: "SAFETY_OFFICER", by: S, status: "APPROVED", comment: "Gas test OK.", minsAgo: 190 }],
    steps: [
      { action: "CREATED", by: R, minsAgo: 300, to: "DRAFT", comment: "Draft permit created." },
      { action: "SUBMITTED", by: R, minsAgo: 280, to: "PENDING_APPROVAL", comment: "Approvals required: AREA_OWNER, SAFETY_OFFICER" },
      { action: "APPROVED", by: O, minsAgo: 200, to: "PENDING_APPROVAL", comment: "Area cleared." },
      { action: "APPROVED", by: S, minsAgo: 190, to: "APPROVED", comment: "Gas test OK." },
      { action: "ACTIVATED", by: R, minsAgo: 115, to: "ACTIVE", comment: "Work may now start." },
    ],
  });
  // 6. ACTIVE confined space, EXPIRING SOON (ends in 90 minutes)
  await make({
    type: "CONFINED_SPACE", status: "ACTIVE", equipmentId: rx.id, contractor: "CleanTech Services", desc: "Internal inspection of reactor R-301 vessel",
    start: -180, end: 90, hazards: ["Toxic gas", "Oxygen deficiency"], ppe: ["Full body harness", "Gas monitor (personal)", "Respirator / SCBA"],
    data: confined(), roles: ["AREA_OWNER", "SAFETY_OFFICER"],
    approvals: [{ role: "AREA_OWNER", by: A, status: "APPROVED", comment: "Approved by admin (no area owner assigned).", minsAgo: 260 }, { role: "SAFETY_OFFICER", by: S, status: "APPROVED", comment: "Atmosphere tested clear.", minsAgo: 250 }],
    steps: [
      { action: "CREATED", by: R, minsAgo: 400, to: "DRAFT", comment: "Draft permit created." },
      { action: "SUBMITTED", by: R, minsAgo: 380, to: "PENDING_APPROVAL", comment: "Approvals required: AREA_OWNER, SAFETY_OFFICER" },
      { action: "APPROVED", by: A, minsAgo: 260, to: "PENDING_APPROVAL", comment: "Approved by admin (no area owner assigned)." },
      { action: "APPROVED", by: S, minsAgo: 250, to: "APPROVED", comment: "Atmosphere tested clear." },
      { action: "ACTIVATED", by: R, minsAgo: 175, to: "ACTIVE", comment: "Work may now start." },
    ],
  });
  // 7. SUSPENDED
  await make({
    type: "WORKING_AT_HEIGHT", status: "SUSPENDED", equipmentId: ct.id, contractor: "SkyLine Scaffolders", desc: "Replace fan guard on cooling tower CT-1",
    start: -240, end: 240, hazards: ["Fall from height", "Moving machinery"], ppe: ["Full body harness", "Hard hat"],
    data: height(), roles: ["AREA_OWNER"], approvals: [{ role: "AREA_OWNER", by: S, status: "APPROVED", minsAgo: 300 }],
    steps: [
      { action: "CREATED", by: R, minsAgo: 500, to: "DRAFT", comment: "Draft permit created." },
      { action: "SUBMITTED", by: R, minsAgo: 480, to: "PENDING_APPROVAL", comment: "Approvals required: AREA_OWNER" },
      { action: "APPROVED", by: S, minsAgo: 300, to: "APPROVED" },
      { action: "ACTIVATED", by: R, minsAgo: 230, to: "ACTIVE", comment: "Work may now start." },
      { action: "SUSPENDED", by: S, minsAgo: 25, to: "SUSPENDED", comment: "Wind speed above safe limit. Stop work until it drops." },
    ],
  });
  // 8. CLOSED, waiting for safety officer verification
  await make({
    type: "ELECTRICAL_LOTO", status: "CLOSED", equipmentId: trf.id, contractor: "VoltEdge Electricals", desc: "Thermography check and tightening of transformer terminals",
    start: -420, end: -60, hazards: ["Electric shock"], ppe: ["Insulated gloves", "Safety glasses"],
    data: loto(), roles: ["AREA_OWNER"], approvals: [{ role: "AREA_OWNER", by: S, status: "APPROVED", minsAgo: 500 }],
    completionNotes: "Terminals tightened, locks removed, area handed back to operations.", closedMinsAgo: 90,
    steps: [
      { action: "CREATED", by: R, minsAgo: 700, to: "DRAFT", comment: "Draft permit created." },
      { action: "SUBMITTED", by: R, minsAgo: 680, to: "PENDING_APPROVAL" },
      { action: "APPROVED", by: S, minsAgo: 500, to: "APPROVED" },
      { action: "ACTIVATED", by: R, minsAgo: 415, to: "ACTIVE" },
      { action: "WORK_COMPLETED", by: R, minsAgo: 90, to: "CLOSED", comment: "Terminals tightened, locks removed, area handed back to operations." },
    ],
  });
  // 9. CLOSED_VERIFIED
  const verified = await make({
    type: "WORKING_AT_HEIGHT", status: "CLOSED_VERIFIED", equipmentId: prk.id, contractor: "SkyLine Scaffolders", desc: "Install new cable tray on pipe rack",
    start: -1600, end: -1200, hazards: ["Fall from height"], ppe: ["Full body harness", "Hard hat"],
    data: height(), roles: ["AREA_OWNER"], approvals: [{ role: "AREA_OWNER", by: O, status: "APPROVED", minsAgo: 1800 }],
    completionNotes: "Cable tray installed and scaffold dismantled.", closedMinsAgo: 1250,
    steps: [
      { action: "CREATED", by: R, minsAgo: 1900, to: "DRAFT" },
      { action: "SUBMITTED", by: R, minsAgo: 1850, to: "PENDING_APPROVAL" },
      { action: "APPROVED", by: O, minsAgo: 1800, to: "APPROVED" },
      { action: "ACTIVATED", by: R, minsAgo: 1590, to: "ACTIVE" },
      { action: "WORK_COMPLETED", by: R, minsAgo: 1250, to: "CLOSED", comment: "Cable tray installed and scaffold dismantled." },
      { action: "CLOSURE_VERIFIED", by: S, minsAgo: 1200, to: "CLOSED_VERIFIED", comment: "Area clean and work complete." },
    ],
  });
  await prisma.closureVerification.create({ data: { permitId: verified.id, verifierId: S.id, areaClean: true, workComplete: true, comment: "Area clean and work complete.", verifiedAt: at(-1200) } });
  // 10. EXPIRED
  await make({
    type: "HOT_WORK", status: "EXPIRED", equipmentId: tnk.id, contractor: "Apex Fabrication", desc: "Grind weld seam on tank T-201 manway",
    start: -600, end: -180, hazards: ["Fire / explosion"], ppe: ["Face shield / welding mask"],
    data: { ...hot(), hotWorkType: "GRINDING" }, roles: ["AREA_OWNER", "SAFETY_OFFICER"],
    approvals: [{ role: "AREA_OWNER", by: S, status: "APPROVED", minsAgo: 700 }, { role: "SAFETY_OFFICER", by: A, status: "APPROVED", minsAgo: 690 }],
    steps: [
      { action: "CREATED", by: R, minsAgo: 800, to: "DRAFT" },
      { action: "SUBMITTED", by: R, minsAgo: 780, to: "PENDING_APPROVAL" },
      { action: "APPROVED", by: S, minsAgo: 700, to: "PENDING_APPROVAL" },
      { action: "APPROVED", by: A, minsAgo: 690, to: "APPROVED" },
      { action: "ACTIVATED", by: R, minsAgo: 590, to: "ACTIVE" },
      { action: "EXPIRED", by: null, minsAgo: 180, to: "EXPIRED", comment: "Validity window ended. The permit can no longer be used." },
    ],
  });
  // 11. REJECTED
  await make({
    type: "CONFINED_SPACE", status: "REJECTED", equipmentId: rx.id, contractor: "CleanTech Services", desc: "Clean sludge from reactor R-301 bottom",
    start: 1400, end: 1700, hazards: ["Toxic gas"], ppe: ["Respirator / SCBA"],
    data: confined(), roles: ["AREA_OWNER", "SAFETY_OFFICER"],
    approvals: [{ role: "AREA_OWNER", by: A, status: "PENDING", minsAgo: 0 }, { role: "SAFETY_OFFICER", by: S, status: "REJECTED", comment: "Rescue plan lacks a second standby person.", minsAgo: 100 }],
    steps: [
      { action: "CREATED", by: R, minsAgo: 300, to: "DRAFT" },
      { action: "SUBMITTED", by: R, minsAgo: 290, to: "PENDING_APPROVAL" },
      { action: "REJECTED", by: S, minsAgo: 100, to: "REJECTED", comment: "Rescue plan lacks a second standby person." },
    ],
  });
  // 12. CANCELLED
  await make({
    type: "ELECTRICAL_LOTO", status: "CANCELLED", equipmentId: ct.id, contractor: "VoltEdge Electricals", desc: "Isolate cooling tower fan motor for bearing change",
    start: 2000, end: 2300, hazards: ["Electric shock"], ppe: ["Insulated gloves"],
    data: { ...loto(), equipmentTag: "CT-410" }, roles: ["AREA_OWNER"], approvals: [{ role: "AREA_OWNER", by: O, status: "PENDING", minsAgo: 0 }],
    steps: [
      { action: "CREATED", by: R, minsAgo: 150, to: "DRAFT" },
      { action: "SUBMITTED", by: R, minsAgo: 140, to: "PENDING_APPROVAL" },
      { action: "CANCELLED", by: R, minsAgo: 60, to: "CANCELLED", comment: "Maintenance rescheduled to next shutdown." },
    ],
  });

  const counts = await prisma.permit.groupBy({ by: ["status"], _count: true });
  console.log("Seed complete. Permits by status:", Object.fromEntries(counts.map((c) => [c.status, c._count])));
  console.log(`Login with any seeded email and password: ${DEMO_PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
