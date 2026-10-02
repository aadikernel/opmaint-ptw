import { PermitStatus, Role } from "@prisma/client";

/**
 * WHO may do WHAT. Pure functions: no database, no Express.
 * The same functions are used (a) to enforce rules on the server and (b) to build `allowedActions`
 * for the UI, so the buttons the user sees can never disagree with what the server accepts.
 * Each function returns null when allowed, or a clear message (used as the 403 error) when not.
 */
export interface Actor {
  id: string;
  name: string;
  role: Role;
  areaId: string | null;
}

export interface PermitFacts {
  requesterId: string;
  /** Area of the permit's equipment (null while a draft has no equipment yet). */
  areaId: string | null;
  status: PermitStatus;
}

export type Verdict = string | null;

const isPrivileged = (u: Actor) => u.role === "SAFETY_OFFICER" || u.role === "ADMIN";
const isOwner = (u: Actor, p: PermitFacts) => p.requesterId === u.id;

export function canView(u: Actor, p: PermitFacts): boolean {
  if (isPrivileged(u)) return true;
  if (isOwner(u, p)) return true;
  if (u.role === "AREA_OWNER") return p.status !== "DRAFT" && !!u.areaId && u.areaId === p.areaId;
  return false;
}

export function canCreate(u: Actor): Verdict {
  return u.role === "REQUESTER" || u.role === "ADMIN" ? null : "Only requesters can create permits.";
}

export function canEditDraft(u: Actor, p: PermitFacts): Verdict {
  if (u.role === "ADMIN") return null;
  if (u.role === "REQUESTER" && isOwner(u, p)) return null;
  return "Only the requester can edit their own draft permit.";
}

export const canSubmit = canEditDraft;

/** Edits after submission (e.g. updating a gas test). Requesters cannot edit once submitted. */
export function canEditSubmitted(u: Actor): Verdict {
  return isPrivileged(u) ? null : "Only a Safety Officer or Admin can edit a permit after submission.";
}

/**
 * Approve / reject. THE critical rule is first: nobody can approve their own permit, whatever their role.
 */
export function canApprove(u: Actor, p: PermitFacts): Verdict {
  if (isOwner(u, p)) return "You cannot approve or reject your own permit.";
  if (u.role === "SAFETY_OFFICER" || u.role === "ADMIN") return null;
  if (u.role === "AREA_OWNER") {
    if (!u.areaId || u.areaId !== p.areaId) return "You are not authorized to approve permits for this area.";
    return null;
  }
  return "Your role is not allowed to approve permits.";
}

export function canActivate(u: Actor, p: PermitFacts): Verdict {
  if (isPrivileged(u) || (u.role === "REQUESTER" && isOwner(u, p))) return null;
  return "Only the requester, a Safety Officer or an Admin can activate this permit.";
}

export function canSuspend(u: Actor): Verdict {
  return isPrivileged(u) ? null : "Only a Safety Officer or Admin can suspend a permit.";
}

export const canResume = canSuspend;

export function canComplete(u: Actor, p: PermitFacts): Verdict {
  if (isPrivileged(u) || (u.role === "REQUESTER" && isOwner(u, p))) return null;
  return "Only the requester, a Safety Officer or an Admin can mark work complete.";
}

export function canVerify(u: Actor, p: PermitFacts): Verdict {
  if (!isPrivileged(u)) return "Only a Safety Officer or Admin can verify closure.";
  if (isOwner(u, p)) return "You cannot verify closure of your own permit.";
  return null;
}

export function canCancel(u: Actor, p: PermitFacts): Verdict {
  if (isPrivileged(u) || (u.role === "REQUESTER" && isOwner(u, p))) return null;
  return "Only the requester, a Safety Officer or an Admin can cancel this permit.";
}

export function canLogWork(u: Actor, p: PermitFacts): Verdict {
  if (isPrivileged(u) || (u.role === "REQUESTER" && isOwner(u, p))) return null;
  return "Only the requester, a Safety Officer or an Admin can log work on this permit.";
}

export function canManageMasterData(u: Actor): Verdict {
  return u.role === "ADMIN" ? null : "Only an Admin can manage users, plants, areas and equipment.";
}
