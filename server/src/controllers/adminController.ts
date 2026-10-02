import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { areaSchema, equipmentSchema, plantSchema, userCreateSchema, userUpdateSchema } from "../validators/permit";
import { badRequest, conflict, notFound } from "../utils/errors";

const safeUser = { id: true, name: true, email: true, role: true, areaId: true, active: true, createdAt: true } as const;

async function uniqueGuard<T>(fn: () => Promise<T>, msg: string): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    if (e?.code === "P2002" || /unique/i.test(String(e?.message))) throw conflict(msg, "DUPLICATE");
    if (e?.code === "P2003") throw badRequest("A referenced record does not exist.");
    throw e;
  }
}

export const listUsers = async (_req: Request, res: Response) => res.json({ users: await prisma.user.findMany({ select: safeUser, orderBy: { name: "asc" } }) });

export async function createUser(req: Request, res: Response) {
  const d = userCreateSchema.parse(req.body);
  const user = await uniqueGuard(
    async () => prisma.user.create({ data: { name: d.name, email: d.email, role: d.role, areaId: d.areaId ?? null, passwordHash: await bcrypt.hash(d.password, 10) }, select: safeUser }),
    "A user with this email already exists.",
  );
  res.status(201).json({ user });
}

export async function updateUser(req: Request, res: Response) {
  const d = userUpdateSchema.parse(req.body);
  const id = String(req.params.id);
  if (!(await prisma.user.findUnique({ where: { id } }))) throw notFound("User not found.");
  if (id === req.user!.id && (d.active === false || (d.role && d.role !== "ADMIN"))) throw conflict("You cannot disable or demote your own admin account.");
  const { password, ...rest } = d;
  const user = await uniqueGuard(
    async () => prisma.user.update({ where: { id }, data: { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) }, select: safeUser }),
    "A user with this email already exists.",
  );
  res.json({ user });
}

export async function createPlant(req: Request, res: Response) {
  const plant = await uniqueGuard(() => prisma.plant.create({ data: plantSchema.parse(req.body) }), "Plant name or code already exists.");
  res.status(201).json({ plant });
}
export async function createArea(req: Request, res: Response) {
  const area = await uniqueGuard(() => prisma.area.create({ data: areaSchema.parse(req.body) }), "This plant already has an area with that name.");
  res.status(201).json({ area });
}
export async function createEquipment(req: Request, res: Response) {
  const equipment = await uniqueGuard(() => prisma.equipment.create({ data: equipmentSchema.parse(req.body) }), "Equipment tag already exists.");
  res.status(201).json({ equipment });
}
export async function updateEquipment(req: Request, res: Response) {
  const equipment = await uniqueGuard(() => prisma.equipment.update({ where: { id: String(req.params.id) }, data: equipmentSchema.partial().parse(req.body) }), "Equipment tag already exists.");
  res.json({ equipment });
}
