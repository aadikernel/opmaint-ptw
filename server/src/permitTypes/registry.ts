import { PermitType } from "@prisma/client";
import { PermitTypeDefinition } from "./types";
import { hotWork } from "./hotWork";
import { confinedSpace } from "./confinedSpace";
import { workingAtHeight } from "./workingAtHeight";
import { electricalLoto } from "./electricalLoto";
import { badRequest } from "../utils/errors";

// To add EXCAVATION: create excavation.ts and add it to this list.
const definitions: PermitTypeDefinition[] = [hotWork, confinedSpace, workingAtHeight, electricalLoto];

export const permitTypeRegistry: Record<string, PermitTypeDefinition> = Object.fromEntries(
  definitions.map((d) => [d.type, d]),
);

export function getTypeDefinition(type: PermitType | string): PermitTypeDefinition {
  const def = permitTypeRegistry[type];
  if (!def) throw badRequest(`Unknown permit type: ${type}`);
  return def;
}

/** Validate type-specific data. Drafts may be incomplete; submitted permits must be complete. */
export function validateTypeData(type: PermitType | string, data: unknown, mode: "draft" | "full") {
  const def = getTypeDefinition(type);
  const schema = mode === "draft" ? def.schema.deepPartial() : def.schema;
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: ["typeSpecificData", ...i.path].join("."), message: i.message }));
    throw badRequest(`Invalid ${def.label} details.`, issues);
  }
  return result.data as Record<string, any>;
}
