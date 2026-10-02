import { z } from "zod";

const dt = z.string().datetime({ message: "Use an ISO date-time like 2026-10-01T09:00:00.000Z" });

export const permitTypeEnum = z.enum(["HOT_WORK", "CONFINED_SPACE", "WORKING_AT_HEIGHT", "ELECTRICAL_LOTO"]);

/** Fields every permit has. All optional while it is a draft; the service checks completeness on submit. */
export const commonFields = z.object({
  contractor: z.string().trim().max(200).optional(),
  workDescription: z.string().trim().max(4000).optional(),
  equipmentId: z.string().uuid().nullable().optional(),
  plannedStart: dt.nullable().optional(),
  plannedEnd: dt.nullable().optional(),
  hazards: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  ppe: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  precautions: z
    .array(z.object({ label: z.string().trim().min(1).max(300), confirmed: z.boolean() }))
    .max(60)
    .optional(),
  /** Extra approver roles the requester asks for. The server always adds the ones the rules require. */
  requiredApprovalRoles: z.array(z.enum(["AREA_OWNER", "SAFETY_OFFICER"])).max(2).optional(),
  typeSpecificData: z.record(z.unknown()).optional(),
});

export const createPermitSchema = commonFields.extend({ permitType: permitTypeEnum });
export const updatePermitSchema = commonFields.extend({ comment: z.string().trim().max(1000).optional() });

export const commentSchema = z.object({ comment: z.string().trim().max(1000).optional() });
export const reasonSchema = z.object({ reason: z.string().trim().min(3, "A reason is required").max(1000) });
export const completeSchema = z.object({ completionNotes: z.string().trim().min(5, "Completion notes are required").max(2000) });
export const verifySchema = z.object({
  areaClean: z.boolean(),
  workComplete: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
});

export const workLogSchema = z
  .object({
    kind: z.enum(["NOTE", "ENTRY", "EXIT"]).default("NOTE"),
    personName: z.string().trim().max(120).optional(),
    note: z.string().trim().min(2, "Write a short note").max(1000),
  })
  .refine((v) => v.kind === "NOTE" || !!v.personName, { message: "Person name is required for entry/exit records", path: ["personName"] });

const csv = z.string().transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean));

export const listQuerySchema = z.object({
  status: csv.optional(),
  type: csv.optional(),
  areaId: z.string().optional(),
  from: dt.optional(),
  to: dt.optional(),
  pendingMyApproval: z.enum(["true", "false"]).optional(),
  expiringSoon: z.enum(["true", "false"]).optional(),
  activeNow: z.enum(["true", "false"]).optional(),
  search: z.string().trim().max(100).optional(),
});

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["REQUESTER", "AREA_OWNER", "SAFETY_OFFICER", "ADMIN"]),
  areaId: z.string().uuid().nullable().optional(),
});
export const userUpdateSchema = userCreateSchema.partial().extend({ active: z.boolean().optional() });
export const plantSchema = z.object({ name: z.string().trim().min(2).max(100), code: z.string().trim().min(1).max(20) });
export const areaSchema = z.object({ name: z.string().trim().min(2).max(100), plantId: z.string().uuid() });
export const equipmentSchema = z.object({ tag: z.string().trim().min(1).max(50), name: z.string().trim().min(2).max(150), areaId: z.string().uuid() });
