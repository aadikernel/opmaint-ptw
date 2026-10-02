import { z } from "zod";
import { PermitTypeDefinition } from "./types";

export const workingAtHeight: PermitTypeDefinition = {
  type: "WORKING_AT_HEIGHT",
  label: "Working at Height",
  risk: "STANDARD",
  schema: z.object({
    heightMetres: z.number().positive().max(300),
    accessMethod: z.enum(["SCAFFOLD", "LADDER", "MEWP", "ROPE"]),
    fallArrestEquipment: z.string().trim().min(2, "Describe the fall arrest equipment"),
    anchorPointChecked: z.boolean(),
    barricadingBelow: z.boolean(),
  }),
  activationIssues(d) {
    const issues: string[] = [];
    if (!d.anchorPointChecked) issues.push("Anchor point has not been checked.");
    if (!d.barricadingBelow) issues.push("Area below the work has not been barricaded.");
    return issues;
  },
  suggestedPrecautions: [
    "Harness inspected and worn",
    "Tools secured against dropping",
    "Weather conditions checked",
    "Rescue plan for a suspended worker",
    "Scaffold tag (green) checked",
  ],
};
