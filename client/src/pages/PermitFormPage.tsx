import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Save, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Banner, Button, Card, ErrorBanner } from "../components/ui";
import { ApprovalSection, CommonFields, EMPTY_FORM, FormState, HazardSection, PermitTypeFields, PPESection, PrecautionsSection, problemsFor, ReviewSection, TypeSelect } from "../components/permit-form/Sections";
import type { Locations, Permit } from "../lib/types";

const STEPS = ["Type", "Details", "Safety data", "Hazards & PPE", "Precautions", "Approvers", "Review"];

/** Remove empty values so a half-filled draft passes server-side draft validation. */
function clean(v: any): any {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== "" && x !== null).map(([k, x]) => [k, clean(x)]));
  }
  return v;
}

export function PermitFormPage() {
  const { id: routeId } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [reached, setReached] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [permitId, setPermitId] = useState<string | undefined>(routeId);
  const [saved, setSaved] = useState<string | null>(null);

  const existing = useQuery({ queryKey: ["permit", routeId], queryFn: () => api<{ permit: Permit }>(`/permits/${routeId}`), enabled: !!routeId });
  const locations = useQuery({ queryKey: ["locations"], queryFn: () => api<Locations>("/reference/locations") });

  useEffect(() => {
    const p = existing.data?.permit;
    if (!p || p.status !== "DRAFT") return;
    setForm({
      permitType: p.permitType, contractor: p.contractor, workDescription: p.workDescription, equipmentId: p.location?.equipment.id ?? "",
      plannedStart: p.plannedStart, plannedEnd: p.plannedEnd, hazards: p.hazards, ppe: p.ppe, precautions: p.precautions,
      requiredApprovalRoles: p.requiredApprovalRoles.filter((r) => r === "SAFETY_OFFICER"), typeSpecificData: p.typeSpecificData ?? {},
    });
    setStep(2); setReached(7);
  }, [existing.data]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const equipmentLabel = (() => {
    for (const pl of locations.data?.plants ?? []) for (const a of pl.areas) for (const e of a.equipment)
      if (e.id === form.equipmentId) return `${pl.name} › ${a.name} › ${e.tag} ${e.name}`;
    return "";
  })();

  const payload = () => ({
    contractor: form.contractor, workDescription: form.workDescription, equipmentId: form.equipmentId || null,
    plannedStart: form.plannedStart, plannedEnd: form.plannedEnd, hazards: form.hazards, ppe: form.ppe,
    precautions: form.precautions, requiredApprovalRoles: form.requiredApprovalRoles, typeSpecificData: clean(form.typeSpecificData),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (permitId) return (await api<{ permit: Permit }>(`/permits/${permitId}`, { method: "PATCH", body: payload() })).permit;
      return (await api<{ permit: Permit }>("/permits", { method: "POST", body: { permitType: form.permitType, ...payload() } })).permit;
    },
    onSuccess: (p) => { setPermitId(p.id); setSaved(`Draft ${p.displayNumber} saved.`); qc.invalidateQueries({ queryKey: ["permits"] }); qc.invalidateQueries({ queryKey: ["stats"] }); },
  });
  const submit = useMutation({
    mutationFn: async () => {
      const p = await save.mutateAsync();
      return api<{ permit: Permit }>(`/permits/${p.id}/submit`, { method: "POST" });
    },
    onSuccess: (r) => { qc.invalidateQueries(); nav(`/permits/${r.permit.id}`); },
  });

  if (routeId && existing.data && existing.data.permit.status !== "DRAFT") {
    return <Banner kind="warn">Only draft permits can be edited. This permit is {existing.data.permit.status}.</Banner>;
  }

  const problems = problemsFor(form, step);
  const allProblems = [1, 2, 4, 5].flatMap((s) => problemsFor(form, s));
  const go = (n: number) => { setStep(n); setReached((r) => Math.max(r, n)); setSaved(null); window.scrollTo({ top: 0 }); };
  const err = save.error ?? submit.error;

  return (
    <div className="space-y-4">
      <h1 className="text-4xl font-bold uppercase">{routeId ? "Edit draft permit" : "New permit to work"}</h1>
      <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Steps">
        {STEPS.map((label, i) => {
          const n = i + 1; const current = n === step; const enabled = n <= reached && (n === 1 ? !permitId : true);
          return (
            <li key={label} className="min-w-fit flex-1">
              <button type="button" disabled={!enabled} onClick={() => go(n)} aria-current={current ? "step" : undefined}
                className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border-2 px-3 font-display text-lg font-semibold uppercase ${current ? "border-ink bg-ink text-white" : n < step ? "border-go bg-white text-go" : "border-line bg-white text-muted"}`}>
                <span>{n}</span><span className="hidden md:inline">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <Card title={`Step ${step}: ${STEPS[step - 1]}`}>
        {step === 1 && <TypeSelect form={form} set={set} />}
        {step === 2 && <CommonFields form={form} set={set} />}
        {step === 3 && <PermitTypeFields form={form} set={set} />}
        {step === 4 && <div className="space-y-6"><HazardSection form={form} set={set} /><PPESection form={form} set={set} /></div>}
        {step === 5 && <PrecautionsSection form={form} set={set} />}
        {step === 6 && <ApprovalSection form={form} set={set} />}
        {step === 7 && <ReviewSection form={form} equipmentLabel={equipmentLabel} />}
      </Card>

      {step === 7 && allProblems.length > 0 && <Banner kind="warn"><p className="font-semibold">Fix these before submitting:</p><ul className="list-disc pl-5">{allProblems.map((p) => <li key={p}>{p}</li>)}</ul></Banner>}
      {step < 7 && problems.length > 0 && <Banner kind="warn"><ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Banner>}
      <ErrorBanner error={err} />
      {saved && <Banner kind="ok">{saved}</Banner>}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-steel/95 px-4 py-3">
        {step > 1 && <Button variant="ghost" onClick={() => go(step - 1)}><ArrowLeft size={18} /> Back</Button>}
        <div className="flex-1" />
        <Button variant="ghost" disabled={!form.permitType || save.isPending} onClick={() => save.mutate()}><Save size={18} /> {save.isPending ? "Saving…" : "Save draft"}</Button>
        {step < 7 ? (
          <Button disabled={problems.length > 0} onClick={() => go(step + 1)}>Next <ArrowRight size={18} /></Button>
        ) : (
          <Button variant="go" disabled={allProblems.length > 0 || submit.isPending} onClick={() => submit.mutate()}><Send size={18} /> {submit.isPending ? "Submitting…" : "Submit for approval"}</Button>
        )}
      </div>
    </div>
  );
}
