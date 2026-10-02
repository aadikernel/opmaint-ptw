import { ConfigFields, FieldGroup, options } from "./fields";

export const hotWorkGroups: FieldGroup[] = [
  { title: "Hot work details", fields: [
    { key: "hotWorkType", label: "Type of hot work", kind: "select", options: options(["WELDING", "GRINDING", "CUTTING", "SOLDERING"]) },
    { key: "fireWatchAssigned", label: "Fire watch assigned (name)", kind: "text" },
    { key: "extinguisherType", label: "Fire extinguisher type present", kind: "select", options: [
      { value: "ABC_DRY_POWDER", label: "ABC dry powder" }, { value: "CO2", label: "CO₂" }, { value: "FOAM", label: "Foam" }, { value: "WATER", label: "Water" }] },
    { key: "combustiblesClearedRadiusM", label: "Combustibles cleared radius", kind: "number", unit: "m", hint: "Must be at least 11 m to activate." },
  ] },
  { title: "Gas test", fields: [
    { key: "gasTest.lelPercent", label: "LEL", kind: "number", unit: "%", hint: "Must be 5% or lower to activate." },
    { key: "gasTest.o2Percent", label: "O₂", kind: "number", unit: "%", hint: "Safe range 19.5 to 23.5%." },
    { key: "gasTest.testTime", label: "Test time", kind: "datetime" },
  ] },
];
export const HotWorkFields = (p: { data: Record<string, any>; onChange(d: Record<string, any>): void }) => <ConfigFields groups={hotWorkGroups} {...p} />;
