import { ConfigFields, FieldGroup, options } from "./fields";

export const workingAtHeightGroups: FieldGroup[] = [
  { title: "Work at height details", fields: [
    { key: "heightMetres", label: "Height", kind: "number", unit: "m" },
    { key: "accessMethod", label: "Access method", kind: "select", options: [
      { value: "SCAFFOLD", label: "Scaffold" }, { value: "LADDER", label: "Ladder" }, { value: "MEWP", label: "MEWP" }, { value: "ROPE", label: "Rope access" }] },
    { key: "fallArrestEquipment", label: "Fall arrest equipment", kind: "text" },
    { key: "anchorPointChecked", label: "Anchor point checked", kind: "bool" },
    { key: "barricadingBelow", label: "Barricading in place below", kind: "bool" },
  ] },
];
void options;
export const WorkingAtHeightFields = (p: { data: Record<string, any>; onChange(d: Record<string, any>): void }) => <ConfigFields groups={workingAtHeightGroups} {...p} />;
