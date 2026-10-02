import { z } from "zod";
import { PermitType } from "@prisma/client";

/**
 * Everything the system needs to know about one permit type.
 * To add a new type (e.g. EXCAVATION): add the enum value, create one file like hotWork.ts,
 * and register it in registry.ts. Nothing else on the server changes.
 */
export interface PermitTypeDefinition {
  type: PermitType;
  label: string;
  /** HIGH risk types always need a Safety Officer approval. */
  risk: "HIGH" | "STANDARD";
  /** Full schema: used when a permit is submitted. Drafts use schema.deepPartial(). */
  schema: z.ZodObject<z.ZodRawShape>;
  /** Safety checks run at activation and at resume. Return a list of blocking problems. */
  activationIssues(data: Record<string, any>): string[];
  /** Suggested precautions shown in the form for this type. */
  suggestedPrecautions: string[];
}

export const isoTime = z.string().datetime();
