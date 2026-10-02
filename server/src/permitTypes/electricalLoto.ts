import { z } from "zod";
import { PermitTypeDefinition } from "./types";

export const electricalLoto: PermitTypeDefinition = {
  type: "ELECTRICAL_LOTO",
  label: "Electrical / Isolation (LOTO)",
  risk: "STANDARD",
  schema: z.object({
    equipmentTag: z.string().trim().min(1, "Equipment tag is required"),
    voltageLevel: z.enum(["LV_BELOW_1KV", "MV_1_TO_33KV", "HV_ABOVE_33KV"]),
    isolationPoints: z
      .array(
        z.object({
          description: z.string().trim().min(2),
          lockNumber: z.string().trim().min(1, "Lock number is required"),
          tagNumber: z.string().trim().min(1, "Tag number is required"),
        }),
      )
      .min(1, "Add at least one isolation point"),
    earthingApplied: z.boolean(),
    testedDeadBy: z.string().trim().min(2, "Name of person who tested dead is required"),
  }),
  activationIssues(d) {
    const issues: string[] = [];
    if (!d.earthingApplied) issues.push("Earthing has not been applied.");
    return issues;
  },
  suggestedPrecautions: [
    "All isolation points locked and tagged",
    "Stored energy released",
    "Tested dead with approved tester",
    "Test instrument proved before and after",
    "Danger tags fitted",
  ],
};
