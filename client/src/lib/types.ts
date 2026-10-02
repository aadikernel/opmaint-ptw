export type Role = "REQUESTER" | "AREA_OWNER" | "SAFETY_OFFICER" | "ADMIN";
export type PermitStatus =
  | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "SUSPENDED"
  | "EXPIRED" | "REJECTED" | "CLOSED" | "CLOSED_VERIFIED" | "CANCELLED";

export interface User { id: string; name: string; email: string; role: Role; areaId: string | null; area?: { id: string; name: string; plant: string } | null }
export interface Precaution { label: string; confirmed: boolean }

export interface Approval {
  id: string; requiredRole: Role; status: "PENDING" | "APPROVED" | "REJECTED";
  approver: { id: string; name: string } | null; comment: string | null; decidedAt: string | null;
}
export interface Conflict { id: string; number: number; permitType: string; status: PermitStatus; equipmentTag: string | null; sameEquipment: boolean; plannedStart: string; plannedEnd: string }

export interface Permit {
  id: string; number: number; displayNumber: string; permitType: string; typeLabel: string; risk: "HIGH" | "STANDARD";
  status: PermitStatus; requester: { id: string; name: string; email: string };
  contractor: string; workDescription: string;
  location: { plant: { id: string; name: string }; area: { id: string; name: string }; equipment: { id: string; tag: string; name: string } } | null;
  plannedStart: string | null; plannedEnd: string | null;
  hazards: string[]; ppe: string[]; precautions: Precaution[];
  requiredApprovalRoles: Role[]; approvals: Approval[];
  typeSpecificData: Record<string, any>;
  submittedAt: string | null; activatedAt: string | null; closedAt: string | null; completionNotes: string | null;
  closure: { verifier: { id: string; name: string }; areaClean: boolean; workComplete: boolean; comment: string | null; verifiedAt: string } | null;
  createdAt: string; updatedAt: string;
  allowedActions: string[]; blockers: string[]; conflicts?: Conflict[];
}

export interface AuditEntry {
  id: string; actorName: string; action: string; fromStatus: PermitStatus | null; toStatus: PermitStatus | null;
  changes: Record<string, { from: unknown; to: unknown }> | null; comment: string | null; createdAt: string;
}
export interface WorkLog { id: string; kind: "NOTE" | "ENTRY" | "EXIT"; personName: string | null; note: string; loggedAt: string; user: { id: string; name: string } }
export interface Stats { active: number; pendingApproval: number; expiringSoon: number; suspended: number; draft: number; recentlyClosed: number; myApprovalsPending: number }
export interface Locations { plants: { id: string; name: string; code: string; areas: { id: string; name: string; equipment: { id: string; tag: string; name: string }[] }[] }[] }
export interface Catalog { hazards: string[]; ppe: string[]; commonPrecautions: string[]; permitTypes: { type: string; label: string; risk: "HIGH" | "STANDARD"; suggestedPrecautions: string[] }[] }
