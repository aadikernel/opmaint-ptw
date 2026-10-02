import { ComponentType } from "react";
import { ConfigView, FieldGroup } from "./fields";
import { HotWorkFields, hotWorkGroups } from "./hotWork";
import { ConfinedSpaceFields, confinedSpaceGroups } from "./confinedSpace";
import { WorkingAtHeightFields, workingAtHeightGroups } from "./workingAtHeight";
import { ElectricalLotoFields, electricalLotoGroups } from "./electricalLoto";
import { Flame, HardHat, Zap, DoorOpen, LucideIcon } from "lucide-react";

interface TypeUi {
  Fields: ComponentType<{ data: Record<string, any>; onChange(d: Record<string, any>): void }>;
  groups: FieldGroup[];
  Icon: LucideIcon;
  blurb: string;
}

/**
 * Client-side registry. To add EXCAVATION: create excavation.tsx (field config + component)
 * and add one line here. The form, review and detail screens pick it up automatically.
 */
export const typeRegistry: Record<string, TypeUi> = {
  HOT_WORK: { Fields: HotWorkFields, groups: hotWorkGroups, Icon: Flame, blurb: "Welding, grinding, cutting or soldering where sparks or heat can ignite something." },
  CONFINED_SPACE: { Fields: ConfinedSpaceFields, groups: confinedSpaceGroups, Icon: DoorOpen, blurb: "Entering a tank, vessel or pit with limited entry and exit." },
  WORKING_AT_HEIGHT: { Fields: WorkingAtHeightFields, groups: workingAtHeightGroups, Icon: HardHat, blurb: "Any work where a fall could cause injury." },
  ELECTRICAL_LOTO: { Fields: ElectricalLotoFields, groups: electricalLotoGroups, Icon: Zap, blurb: "Isolating electrical or energy sources with locks and tags." },
};

export function TypeSpecificView({ type, data }: { type: string; data: Record<string, any> }) {
  const t = typeRegistry[type];
  return t ? <ConfigView groups={t.groups} data={data} /> : <p className="text-muted">No view for this permit type.</p>;
}
