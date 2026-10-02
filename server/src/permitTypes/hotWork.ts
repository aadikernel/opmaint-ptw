import { z } from "zod";
import { PermitTypeDefinition, isoTime } from "./types";

export const hotWork: PermitTypeDefinition = {
  type: "HOT_WORK",
  label: "Hot Work",
  risk: "HIGH",
  schema: z.object({
    hotWorkType: z.enum(["WELDING", "GRINDING", "CUTTING", "SOLDERING"]),
    fireWatchAssigned: z.string().trim().min(2, "Fire watch name is required"),
    extinguisherType: z.enum(["ABC_DRY_POWDER", "CO2", "FOAM", "WATER"]),
    combustiblesClearedRadiusM: z.number().min(0).max(100),
    gasTest: z.object({
      lelPercent: z.number().min(0).max(100),
      o2Percent: z.number().min(0).max(100),
      testTime: isoTime,
    }),
  }),
  activationIssues(d) {
    const issues: string[] = [];
    const g = d.gasTest;
    if (g.lelPercent > 5) issues.push(`LEL reading ${g.lelPercent}% is above the 5% limit for hot work.`);
    if (g.o2Percent < 19.5 || g.o2Percent > 23.5) issues.push(`O2 reading ${g.o2Percent}% is outside 19.5-23.5%.`);
    if (d.combustiblesClearedRadiusM < 11) issues.push("Combustibles must be cleared to at least 11 m radius.");
    return issues;
  },
  suggestedPrecautions: [
    "Fire blanket / spark screens in place",
    "Combustible materials removed or covered",
    "Fire extinguisher at the work point",
    "Drains and openings covered",
    "Fire watch stays 30 min after work ends",
  ],
};
