import { ConfigFields, FieldGroup } from "./fields";

export const electricalLotoGroups: FieldGroup[] = [
  { title: "Equipment", fields: [
    { key: "equipmentTag", label: "Equipment tag", kind: "text" },
    { key: "voltageLevel", label: "Voltage level", kind: "select", options: [
      { value: "LV_BELOW_1KV", label: "Low voltage (below 1 kV)" }, { value: "MV_1_TO_33KV", label: "Medium voltage (1 to 33 kV)" }, { value: "HV_ABOVE_33KV", label: "High voltage (above 33 kV)" }] },
  ] },
  { title: "Isolation", fields: [
    { key: "isolationPoints", label: "Isolation points (lock and tag for each)", kind: "isolationPoints" },
    { key: "earthingApplied", label: "Earthing applied", kind: "bool" },
    { key: "testedDeadBy", label: "Tested dead by (name)", kind: "text" },
  ] },
];
export const ElectricalLotoFields = (p: { data: Record<string, any>; onChange(d: Record<string, any>): void }) => <ConfigFields groups={electricalLotoGroups} {...p} />;
