import { ConfigFields, FieldGroup, options } from "./fields";

export const confinedSpaceGroups: FieldGroup[] = [
  { title: "Space", fields: [
    { key: "spaceId", label: "Space ID", kind: "text" },
    { key: "entryPoint", label: "Entry point", kind: "text" },
    { key: "ventilationMethod", label: "Ventilation method", kind: "select", options: options(["NATURAL", "MECHANICAL_FORCED", "LOCAL_EXHAUST"]) },
    { key: "standbyAttendant", label: "Standby attendant name", kind: "text" },
    { key: "rescuePlan", label: "Rescue plan", kind: "textarea", hint: "Who rescues, with what equipment, from where." },
  ] },
  { title: "Atmospheric test", fields: [
    { key: "atmosphericTest.o2Percent", label: "O₂", kind: "number", unit: "%", hint: "Safe range 19.5 to 23.5%." },
    { key: "atmosphericTest.lelPercent", label: "LEL", kind: "number", unit: "%", hint: "Must be 5% or lower." },
    { key: "atmosphericTest.h2sPpm", label: "H₂S", kind: "number", unit: "ppm", hint: "Must be 10 ppm or lower." },
    { key: "atmosphericTest.coPpm", label: "CO", kind: "number", unit: "ppm", hint: "Must be 25 ppm or lower." },
    { key: "atmosphericTest.testTime", label: "Test time", kind: "datetime" },
  ] },
];
export const ConfinedSpaceFields = (p: { data: Record<string, any>; onChange(d: Record<string, any>): void }) => <ConfigFields groups={confinedSpaceGroups} {...p} />;
