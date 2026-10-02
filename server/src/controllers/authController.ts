import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { signToken } from "../middleware/auth";
import { loginSchema } from "../validators/permit";
import { unauthorized } from "../utils/errors";

const publicUser = (u: { id: string; name: string; email: string; role: string; areaId: string | null }) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, areaId: u.areaId,
});

// A real hash so unknown emails take the same time as wrong passwords.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.1ZkG8JZ5s1e0k0m8m7m6oZbq1b6e";

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !ok) throw unauthorized("Wrong email or password.");
  res.json({ token: signToken(user.id), user: publicUser(user) });
}

export async function me(req: Request, res: Response) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: { area: { include: { plant: true } } } });
  res.json({ user: { ...publicUser(u), area: u.area ? { id: u.area.id, name: u.area.name, plant: u.area.plant.name } : null } });
}
