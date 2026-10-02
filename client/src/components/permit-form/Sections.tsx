import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { api } from "../../api/client";
import { Banner, Button, Label, Select, TextArea, TextInput } from "../ui";
import { fmtDateTime, fromLocalInput, toLocalInput } from "../../lib/format";
import type { Catalog, Locations, Precaution } from "../../lib/types";
import { typeRegistry, TypeSpecificView } from "../../permitTypes/registry";

export interface FormState {
  permitType: string; contractor: string; workDescription: string; equipmentId: string;
  plannedStart: string | null; plannedEnd: string | null;
  hazards: string[]; ppe: string[]; precautions: Precaution[];
  requiredApprovalRoles: string[]; typeSpecificData: Record<string, any>;
}
export const EMPTY_FORM: FormState = {
  permitType: "", contractor: "", workDescription: "", equipmentId: "", plannedStart: null, plannedEnd: null,
  hazards: [], ppe: [], precautions: [], requiredApprovalRoles: [], typeSpecificData: {},
};
interface P { form: FormState; set(patch: Partial<FormState>): void }

export const useCatalog = () => useQuery({ queryKey: ["catalog"], queryFn: () => api<Catalog>("/reference/catalog"), staleTime: Infinity });
const useLocations = () => useQuery({ queryKey: ["locations"], queryFn: () => api<Locations>("/reference/locations") });

/** Step 1 */
export function TypeSelect({ form, set }: P) {
  const catalog = useCatalog();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {catalog.data?.permitTypes.map((t) => {
        const ui = typeRegistry[t.type];
        const selected = form.permitType === t.type;
        return (
          <button key={t.type} type="button" onClick={() => set({ permitType: t.type, typeSpecificData: t.type === form.permitType ? form.typeSpecificData : {}, precautions: [] })}
            aria-pressed={selected} className={`rounded-sm border-2 p-4 text-left ${selected ? "border-ink bg-hazard" : "border-line bg-white hover:bg-steel"}`}>
            <div className="flex items-center gap-2">{ui && <ui.Icon size={26} aria-hidden />}<span className="font-display text-2xl font-bold uppercase">{t.label}</span></div>
            <p className="mt-1 text-base">{ui?.blurb}</p>
            {t.risk === "HIGH" && <p className="mt-2 text-sm font-semibold">High risk: always needs a Safety Officer approval.</p>}
          </button>
        );
      })}
    </div>
  );
}

/** Step 2 */
export function CommonFields({ form, set }: P) {
  const locations = useLocations();
  const plants = locations.data?.plants ?? [];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Label text="Contractor / team doing the work"><TextInput value={form.contractor} onChange={(e) => set({ contractor: e.target.value })} /></Label>
      <Label text="Equipment (exact location)" hint="Plant, area and equipment are all set by choosing the equipment.">
        <Select value={form.equipmentId} onChange={(e) => set({ equipmentId: e.target.value })}>
          <option value="">Select equipment…</option>
          {plants.map((pl) => pl.areas.map((a) => (
            <optgroup key={a.id} label={`${pl.name} › ${a.name}`}>
              {a.equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.tag} · {eq.name}</option>)}
            </optgroup>
          )))}
        </Select>
      </Label>
      <div className="sm:col-span-2"><Label text="Work description" hint="What exactly will be done? At least 10 characters."><TextArea value={form.workDescription} onChange={(e) => set({ workDescription: e.target.value })} /></Label></div>
      <Label text="Planned start"><TextInput type="datetime-local" value={toLocalInput(form.plannedStart)} onChange={(e) => set({ plannedStart: fromLocalInput(e.target.value) })} /></Label>
      <Label text="Planned end" hint="The permit expires automatically at this time."><TextInput type="datetime-local" value={toLocalInput(form.plannedEnd)} onChange={(e) => set({ plannedEnd: fromLocalInput(e.target.value) })} /></Label>
    </div>
  );
}

/** Step 3: the right fields for the chosen type come from the registry */
export function PermitTypeFields({ form, set }: P) {
  const ui = typeRegistry[form.permitType];
  if (!ui) return <Banner kind="warn">Choose a permit type first.</Banner>;
  return <ui.Fields data={form.typeSpecificData} onChange={(d) => set({ typeSpecificData: d })} />;
}

function CheckGrid({ items, selected, onToggle }: { items: string[]; selected: string[]; onToggle(i: string): void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((i) => {
        const on = selected.includes(i);
        return (
          <label key={i} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border-2 px-3 py-2 ${on ? "border-ink bg-hazard/40" : "border-line bg-white"}`}>
            <input type="checkbox" className="size-5 shrink-0" checked={on} onChange={() => onToggle(i)} /> <span>{i}</span>
          </label>
        );
      })}
    </div>
  );
}
const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** Step 4 (two parts) */
export function HazardSection({ form, set }: P) {
  const c = useCatalog();
  return <div><h3 className="mb-2 text-xl font-semibold uppercase">Hazards identified</h3><CheckGrid items={c.data?.hazards ?? []} selected={form.hazards} onToggle={(i) => set({ hazards: toggle(form.hazards, i) })} /></div>;
}
export function PPESection({ form, set }: P) {
  const c = useCatalog();
  return <div><h3 className="mb-2 text-xl font-semibold uppercase">PPE required</h3><CheckGrid items={c.data?.ppe ?? []} selected={form.ppe} onToggle={(i) => set({ ppe: toggle(form.ppe, i) })} /></div>;
}

/** Step 5: every ticked precaution is a promise that it is in place. */
export function PrecautionsSection({ form, set }: P) {
  const c = useCatalog();
  const [custom, setCustom] = useState("");
  const typeItems = c.data?.permitTypes.find((t) => t.type === form.permitType)?.suggestedPrecautions ?? [];
  const items = [...typeItems, ...(c.data?.commonPrecautions ?? []), ...form.precautions.map((p) => p.label).filter((l) => !typeItems.includes(l) && !(c.data?.commonPrecautions ?? []).includes(l))];
  const selected = form.precautions.map((p) => p.label);
  const flip = (label: string) => set({ precautions: selected.includes(label) ? form.precautions.filter((p) => p.label !== label) : [...form.precautions, { label, confirmed: true }] });
  return (
    <div className="space-y-4">
      <Banner kind="info">Tick a precaution only when it is already in place on site. Every ticked item is recorded as confirmed by you.</Banner>
      <CheckGrid items={items} selected={selected} onToggle={flip} />
      <div className="flex gap-2">
        <div className="flex-1"><TextInput placeholder="Add another precaution…" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Custom precaution" /></div>
        <Button type="button" variant="ghost" disabled={!custom.trim()} onClick={() => { flip(custom.trim()); setCustom(""); }}><Plus size={18} /> Add</Button>
      </div>
    </div>
  );
}

/** Step 6: the server decides who must approve; the requester can only add a Safety Officer. */
export function ApprovalSection({ form, set }: P) {
  const preview = useQuery({
    queryKey: ["approver-preview", form.equipmentId, form.permitType],
    queryFn: () => api<{ slots: { role: string; required: boolean; reason: string; eligible: { id: string; name: string }[]; note: string | null }[] }>(`/reference/approver-preview?equipmentId=${form.equipmentId}&permitType=${form.permitType}`),
    enabled: !!form.permitType,
  });
  const wantsSO = form.requiredApprovalRoles.includes("SAFETY_OFFICER");
  return (
    <div className="space-y-3">
      <Banner kind="info">Nobody can approve their own permit. The permit becomes APPROVED only when every required approver has approved.</Banner>
      {preview.data?.slots.map((s) => (
        <div key={s.role} className="rounded-sm border-2 border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-semibold uppercase">{s.role === "AREA_OWNER" ? "Area Owner" : "Safety Officer"}</h3>
            {s.required ? <span className="rounded-sm bg-ink px-2 text-sm font-semibold text-white">Required</span>
              : <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-5" checked={wantsSO} onChange={(e) => set({ requiredApprovalRoles: e.target.checked ? ["SAFETY_OFFICER"] : [] })} /> Also require</label>}
          </div>
          <p className="text-muted">{s.reason}</p>
          <p className="mt-1 text-base">{s.eligible.length ? `Can approve: ${s.eligible.map((u) => u.name).join(", ")}` : s.note}</p>
          {s.role === "AREA_OWNER" && s.note && s.eligible.length > 0 && <p className="text-sm text-muted">{s.note}</p>}
        </div>
      ))}
    </div>
  );
}

export function problemsFor(f: FormState, step: number): string[] {
  const out: string[] = [];
  if (step === 1 && !f.permitType) out.push("Choose a permit type.");
  if (step === 2) {
    if (!f.contractor.trim()) out.push("Enter the contractor or team.");
    if (f.workDescription.trim().length < 10) out.push("Describe the work (at least 10 characters).");
    if (!f.equipmentId) out.push("Select the equipment.");
    if (!f.plannedStart || !f.plannedEnd) out.push("Set planned start and end.");
    else if (new Date(f.plannedEnd) <= new Date(f.plannedStart)) out.push("Planned end must be after planned start.");
    else if (new Date(f.plannedEnd) <= new Date()) out.push("Planned end must be in the future.");
  }
  if (step === 4) {
    if (!f.hazards.length) out.push("Select at least one hazard.");
    if (!f.ppe.length) out.push("Select the PPE required.");
  }
  if (step === 5 && !f.precautions.length) out.push("Select at least one precaution.");
  return out;
}

/** Step 7 */
export function ReviewSection({ form, equipmentLabel }: { form: FormState; equipmentLabel: string }) {
  const c = useCatalog();
  const label = c.data?.permitTypes.find((t) => t.type === form.permitType)?.label ?? form.permitType;
  const row = (k: string, v: string) => <div><dt className="text-sm text-muted">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>;
  return (
    <div className="space-y-5">
      <dl className="grid gap-3 sm:grid-cols-2">
        {row("Permit type", label)}{row("Contractor / team", form.contractor)}
        {row("Equipment", equipmentLabel)}{row("Window", `${fmtDateTime(form.plannedStart)} → ${fmtDateTime(form.plannedEnd)}`)}
        <div className="sm:col-span-2">{row("Work description", form.workDescription)}</div>
        {row("Hazards", form.hazards.join(", "))}{row("PPE", form.ppe.join(", "))}
        <div className="sm:col-span-2">{row("Precautions confirmed", form.precautions.map((p) => p.label).join("; "))}</div>
      </dl>
      <div className="border-t border-line pt-4"><TypeSpecificView type={form.permitType} data={form.typeSpecificData} /></div>
    </div>
  );
}
