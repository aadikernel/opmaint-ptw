import { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { permitTypeRegistry } from "../permitTypes/registry";
import { HAZARDS, PPE_ITEMS, COMMON_PRECAUTIONS } from "../config/catalog";

export async function plantsAreasEquipment(_req: Request, res: Response) {
  const plants = await prisma.plant.findMany({
    orderBy: { name: "asc" },
    include: { areas: { orderBy: { name: "asc" }, include: { equipment: { orderBy: { tag: "asc" } } } } },
  });
  res.json({ plants });
}

export function catalog(_req: Request, res: Response) {
  res.json({
    hazards: HAZARDS,
    ppe: PPE_ITEMS,
    commonPrecautions: COMMON_PRECAUTIONS,
    permitTypes: Object.values(permitTypeRegistry).map((d) => ({
      type: d.type, label: d.label, risk: d.risk, suggestedPrecautions: d.suggestedPrecautions,
    })),
  });
}

/** Step 6 of the form: who will have to approve this permit? Only names and roles are returned. */
export async function approverPreview(req: Request, res: Response) {
  const equipmentId = String(req.query.equipmentId ?? "");
  const type = String(req.query.permitType ?? "");
  const def = permitTypeRegistry[type];
  const eq = equipmentId ? await prisma.equipment.findUnique({ where: { id: equipmentId }, include: { area: true } }) : null;
  const areaOwners = eq
    ? await prisma.user.findMany({ where: { role: "AREA_OWNER", areaId: eq.areaId, active: true }, select: { id: true, name: true } })
    : [];
  const safetyOfficers = await prisma.user.findMany({ where: { role: "SAFETY_OFFICER", active: true }, select: { id: true, name: true } });
  res.json({
    slots: [
      { role: "AREA_OWNER", required: true, reason: "Always required for the area of the equipment.", eligible: areaOwners.length ? areaOwners : [], note: areaOwners.length ? null : "No Area Owner assigned: a Safety Officer or Admin can fill this slot." },
      { role: "SAFETY_OFFICER", required: def?.risk === "HIGH", reason: def?.risk === "HIGH" ? `Required for ${def.label} (high risk).` : "Optional: tick to also require a Safety Officer.", eligible: safetyOfficers, note: null },
    ],
  });
}

export async function approverUsers(_req: Request, res: Response) {
  res.json({ users: await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true, areaId: true }, orderBy: { name: "asc" } }) });
}
