import { z } from "zod";
import { PermitTypeDefinition, isoTime } from "./types";

export const confinedSpace: PermitTypeDefinition = {
  type: "CONFINED_SPACE",
  label: "Confined Space Entry",
  risk: "HIGH",
  schema: z.object({
    spaceId: z.string().trim().min(1, "Space ID is required"),
    entryPoint: z.string().trim().min(1, "Entry point is required"),
    atmosphericTest: z.object({
      o2Percent: z.number().min(0).max(100),
      lelPercent: z.number().min(0).max(100),
      h2sPpm: z.number().min(0).max(1000),
      coPpm: z.number().min(0).max(1000),
      testTime: isoTime,
    }),
    standbyAttendant: z.string().trim().min(2, "Standby attendant is required"),
    rescuePlan: z.string().trim().min(10, "Describe the rescue plan"),
    ventilationMethod: z.enum(["NATURAL", "MECHANICAL_FORCED", "LOCAL_EXHAUST"]),
    // The entry/exit log is stored as WorkLog rows (kind ENTRY / EXIT) so it is time-stamped and only writable while ACTIVE.
  }),
  activationIssues(d) {
    const a = d.atmosphericTest;
    const issues: string[] = [];
    if (a.o2Percent < 19.5 || a.o2Percent > 23.5) issues.push(`O2 reading ${a.o2Percent}% is outside 19.5-23.5%.`);
    if (a.lelPercent > 5) issues.push(`LEL reading ${a.lelPercent}% is above 5%.`);
    if (a.h2sPpm > 10) issues.push(`H2S reading ${a.h2sPpm} ppm is above 10 ppm.`);
    if (a.coPpm > 25) issues.push(`CO reading ${a.coPpm} ppm is above 25 ppm.`);
    return issues;
  },
  suggestedPrecautions: [
    "Space isolated from process lines (blanked/disconnected)",
    "Space cleaned and drained",
    "Ventilation running before and during entry",
    "Rescue equipment (tripod/harness) at entry point",
    "Standby attendant in place and in contact",
  ],
};
