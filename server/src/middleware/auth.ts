import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { Actor } from "../policies/permitPolicy";
import { unauthorized } from "../utils/errors";

declare module "express-serve-static-core" {
  interface Request {
    user?: Actor;
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "8h" });
}

/**
 * Identity comes ONLY from the signed token. We then reload the user from the database,
 * so the role/area used for every decision is the real current one, never something the client sent.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw unauthorized();
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    } catch {
      throw unauthorized("Invalid or expired token.");
    }
    const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } });
    if (!user || !user.active) throw unauthorized("User no longer exists or is disabled.");
    req.user = { id: user.id, name: user.name, role: user.role, areaId: user.areaId };
    next();
  } catch (e) {
    next(e);
  }
}
