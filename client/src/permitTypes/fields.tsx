import { Plus, Trash2 } from "lucide-react";
import { getIn, humanize, fmtDateTime, setIn, toLocalInput, fromLocalInput } from "../lib/format";
import { Button, Label, Select, TextArea, TextInput } from "../components/ui";

/**
 * A tiny declarative field system. Each permit type describes its fields as data (see hotWork.tsx etc.)
 * and these shared components render BOTH the form and the read-only view. That is how we avoid
 * four duplicated forms, and how a fifth type (EXCAVATION) is added with one new config file.
 */
export type FieldDef =
  | { key: string; label: string; kind: "text" | "textarea"; hint?: string }
  | { key: string; label: string; kind: "number"; unit?: string; step?: number; hint?: string }
  | { key: string; label: string; kind: "bool"; yes?: string; no?: string }
  | { key: string; label: string; kind: "datetime"; hint?: string }
  | { key: string; label: string; kind: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: "isolationPoints" };

export interface FieldGroup { title: string; fields: FieldDef[] }
type Data = Record<string, any>;

const opt = (values: string[]) => values.map((v) => ({ value: v, label: humanize(v) }));
export const options = opt;

function IsolationPoints({ value, onChange }: { value: any[]; onChange(v: any[]): void }) {
  const rows = value ?? [];
  const set = (i: number, k: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 rounded-sm border border-line bg-steel/50 p-3 sm:grid-cols-3">
          <Label text="Isolation point"><TextInput value={r.description ?? ""} onChange={(e) => set(i, "description", e.target.value)} /></Label>
          <Label text="Lock number"><TextInput value={r.lockNumber ?? ""} onChange={(e) => set(i, "lockNumber", e.target.value)} /></Label>
          <Label text="Tag number"><TextInput value={r.tagNumber ?? ""} onChange={(e) => set(i, "tagNumber", e.target.value)} /></Label>
          <div className="sm:col-span-3">
            <Button type="button" variant="ghost" className="min-h-9 text-base" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={16} /> Remove point</Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" onClick={() => onChange([...rows, { description: "", lockNumber: "", tagNumber: "" }])}><Plus size={18} /> Add isolation point</Button>
    </div>
  );
}

export function FieldInput({ def, data, onChange }: { def: FieldDef; data: Data; onChange(next: Data): void }) {
  const value = getIn(data, def.key);
  const set = (v: unknown) => onChange(setIn(data, def.key, v));
  switch (def.kind) {
    case "text":
      return <Label text={def.label} hint={def.hint}><TextInput value={value ?? ""} onChange={(e) => set(e.target.value)} /></Label>;
    case "textarea":
      return <Label text={def.label} hint={def.hint}><TextArea value={value ?? ""} onChange={(e) => set(e.target.value)} /></Label>;
    case "number":
      return (
        <Label text={`${def.label}${def.unit ? ` (${def.unit})` : ""}`} hint={def.hint}>
          <TextInput type="number" inputMode="decimal" step={def.step ?? "any"} value={value ?? ""} onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))} />
        </Label>
      );
    case "datetime":
      return <Label text={def.label} hint={def.hint}><TextInput type="datetime-local" value={toLocalInput(value)} onChange={(e) => set(fromLocalInput(e.target.value) ?? undefined)} /></Label>;
    case "select":
      return (
        <Label text={def.label}>
          <Select value={value ?? ""} onChange={(e) => set(e.target.value || undefined)}>
            <option value="">Select…</option>
            {def.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Label>
      );
    case "bool":
      return (
        <fieldset>
          <legend className="mb-1 text-base font-medium">{def.label}</legend>
          <div className="flex gap-2">
            {[true, false].map((b) => (
              <label key={String(b)} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm border-2 px-3 font-medium ${value === b ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
                <input type="radio" className="sr-only" name={def.key} checked={value === b} onChange={() => set(b)} />
                {b ? def.yes ?? "Yes" : def.no ?? "No"}
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "isolationPoints":
      return <div><p className="mb-1 text-base font-medium">{def.label}</p><IsolationPoints value={value} onChange={set} /></div>;
  }
}

/** Renders the form for a list of field groups. Used by every permit type. */
export function ConfigFields({ groups, data, onChange }: { groups: FieldGroup[]; data: Data; onChange(next: Data): void }) {
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <fieldset key={g.title} className="rounded-sm border border-line p-4">
          <legend className="px-2 font-display text-xl font-semibold uppercase">{g.title}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.fields.map((f) => (
              <div key={f.key} className={f.kind === "textarea" || f.kind === "isolationPoints" ? "sm:col-span-2" : ""}>
                <FieldInput def={f} data={data} onChange={onChange} />
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function display(def: FieldDef, v: any): string {
  if (v === undefined || v === null || v === "") return "—";
  switch (def.kind) {
    case "bool": return v ? def.yes ?? "Yes" : def.no ?? "No";
    case "datetime": return fmtDateTime(v);
    case "number": return `${v}${def.unit ? ` ${def.unit}` : ""}`;
    case "select": return def.options.find((o) => o.value === v)?.label ?? humanize(String(v));
    default: return String(v);
  }
}

/** Read-only view of type-specific data (permit detail, approval and review screens). */
export function ConfigView({ groups, data }: { groups: FieldGroup[]; data: Data }) {
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.title}>
          <h3 className="mb-2 text-lg font-semibold uppercase text-muted">{g.title}</h3>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {g.fields.map((f) =>
              f.kind === "isolationPoints" ? (
                <div key={f.key} className="sm:col-span-2">
                  <dt className="text-sm text-muted">{f.label}</dt>
                  <dd>
                    <ul className="mt-1 divide-y divide-line rounded-sm border border-line">
                      {(getIn(data, f.key) ?? []).map((p: any, i: number) => (
                        <li key={i} className="flex flex-wrap gap-x-6 px-3 py-2"><span className="font-medium">{p.description}</span><span>Lock {p.lockNumber}</span><span>Tag {p.tagNumber}</span></li>
                      ))}
                      {!(getIn(data, f.key) ?? []).length && <li className="px-3 py-2 text-muted">—</li>}
                    </ul>
                  </dd>
                </div>
              ) : (
                <div key={f.key}><dt className="text-sm text-muted">{f.label}</dt><dd className="text-base font-medium">{display(f, getIn(data, f.key))}</dd></div>
              ),
            )}
          </dl>
        </div>
      ))}
    </div>
  );
}
