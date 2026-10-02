import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, ArrowLeft, Check, Clock, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Banner, Card, ErrorBanner } from "../components/ui";
import { StatusBadge } from "../components/StatusBadge";
import { Countdown } from "../components/Countdown";
import { ActionPanel } from "../components/permit/ActionPanel";
import { AuditTimeline } from "../components/permit/AuditTimeline";
import { WorkLogPanel } from "../components/permit/WorkLogPanel";
import { TypeSpecificView, typeRegistry } from "../permitTypes/registry";
import type { Permit } from "../lib/types";
import { fmtDateTime, humanize, ROLE_LABEL } from "../lib/format";

const BANNER: Partial<Record<Permit["status"], { kind: "error" | "warn" | "info" | "ok"; text: string }>> = {
  ACTIVE: { kind: "ok", text: "ACTIVE: work is authorised inside the validity window only." },
  SUSPENDED: { kind: "warn", text: "SUSPENDED: STOP WORK. Do not continue until the permit is resumed." },
  EXPIRED: { kind: "error", text: "EXPIRED: this permit can never be reactivated. Create a new permit to continue work." },
  REJECTED: { kind: "error", text: "REJECTED: this permit was not approved. Create a new permit if the work is still needed." },
  CANCELLED: { kind: "info", text: "CANCELLED: this permit is no longer valid." },
  CLOSED: { kind: "info", text: "Work is complete. Waiting for the Safety Officer to verify closure." },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-sm text-muted">{label}</dt><dd className="text-base font-medium">{children || "—"}</dd></div>;
}

export function PermitDetailPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["permit", id], queryFn: () => api<{ permit: Permit }>(`/permits/${id}`), refetchInterval: 30_000 });
  if (q.isLoading) return <p>Loading permit…</p>;
  if (q.error) return <div className="space-y-3"><Link to="/" className="inline-flex items-center gap-1 underline"><ArrowLeft size={16} /> Back</Link><ErrorBanner error={q.error} /></div>;
  const p = q.data!.permit;
  const Icon = typeRegistry[p.permitType]?.Icon;
  const banner = BANNER[p.status];
  const canApprove = p.allowedActions.includes("approve");

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex min-h-11 items-center gap-1 underline"><ArrowLeft size={16} /> All permits</Link>

      <div className="rounded-sm border border-line bg-white">
        <div className="hazard-stripe h-2" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="flex items-center gap-2 text-muted">{Icon && <Icon size={20} />}<span className="text-lg font-medium">{p.typeLabel}</span>{p.risk === "HIGH" && <span className="rounded-sm bg-ink px-1.5 text-sm font-semibold text-hazard">High risk</span>}</div>
            <h1 className="text-5xl font-bold leading-none">{p.displayNumber}</h1>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <StatusBadge status={p.status} large />
            {p.status === "ACTIVE" && <Countdown end={p.plannedEnd} className="text-2xl" />}
          </div>
        </div>
      </div>

      {banner && <Banner kind={banner.kind}>{banner.text}</Banner>}
      {p.conflicts && p.conflicts.length > 0 && (
        <Banner kind="warn">
          <p className="inline-flex items-center gap-1 font-semibold"><AlertOctagon size={18} /> Conflicting work warning</p>
          <ul className="list-disc pl-5">
            {p.conflicts.map((c) => (
              <li key={c.id}><Link className="underline" to={`/permits/${c.id}`}>PTW-{String(c.number).padStart(4, "0")}</Link> ({humanize(c.permitType)}, {humanize(c.status)}) overlaps in time in the same area{c.sameEquipment ? " on the same equipment" : ""}: {fmtDateTime(c.plannedStart)} → {fmtDateTime(c.plannedEnd)}. Hot work and confined space entry must not run together.</li>
            ))}
          </ul>
        </Banner>
      )}

      <Card title={canApprove ? "Your decision is needed" : "Actions"} className={canApprove ? "border-2 border-info" : ""}>
        {canApprove && <p className="mb-3">Review the work, hazards, precautions and safety readings below before you approve or reject.</p>}
        <ActionPanel permit={p} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Work">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Work description">{p.workDescription}</Field></div>
              <Field label="Requester">{p.requester.name}</Field>
              <Field label="Contractor / team">{p.contractor}</Field>
              <Field label="Plant">{p.location?.plant.name}</Field>
              <Field label="Area">{p.location?.area.name}</Field>
              <Field label="Equipment">{p.location && `${p.location.equipment.tag} · ${p.location.equipment.name}`}</Field>
              <Field label="Planned window">{fmtDateTime(p.plannedStart)} → {fmtDateTime(p.plannedEnd)}</Field>
            </dl>
          </Card>
          <Card title="Safety information specific to this permit"><TypeSpecificView type={p.permitType} data={p.typeSpecificData} /></Card>
          <Card title="Hazards, PPE and precautions">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><h3 className="mb-1 text-lg font-semibold uppercase text-muted">Hazards</h3><ul className="flex flex-wrap gap-1.5">{p.hazards.map((h) => <li key={h} className="rounded-sm border-2 border-ink bg-hazard/40 px-2">{h}</li>)}{!p.hazards.length && <li className="text-muted">None listed</li>}</ul></div>
              <div><h3 className="mb-1 text-lg font-semibold uppercase text-muted">PPE required</h3><ul className="flex flex-wrap gap-1.5">{p.ppe.map((h) => <li key={h} className="rounded-sm border-2 border-line bg-white px-2">{h}</li>)}{!p.ppe.length && <li className="text-muted">None listed</li>}</ul></div>
              <div className="sm:col-span-2"><h3 className="mb-1 text-lg font-semibold uppercase text-muted">Precautions</h3>
                <ul className="space-y-1">{p.precautions.map((c) => <li key={c.label} className="flex items-start gap-2">{c.confirmed ? <Check size={20} className="mt-0.5 shrink-0 text-go" aria-label="Confirmed" /> : <X size={20} className="mt-0.5 shrink-0 text-stop" aria-label="Not confirmed" />}{c.label}</li>)}{!p.precautions.length && <li className="text-muted">None listed</li>}</ul></div>
            </div>
          </Card>
          {(p.status === "ACTIVE" || p.status === "SUSPENDED" || p.status === "CLOSED" || p.status === "CLOSED_VERIFIED" || p.status === "EXPIRED") && (
            <Card title="Work log"><WorkLogPanel permit={p} /></Card>
          )}
          {(p.completionNotes || p.closure) && (
            <Card title="Closure">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Completion notes (requester)">{p.completionNotes}</Field></div>
                {p.closure && <><Field label="Verified by">{p.closure.verifier.name}</Field><Field label="Verified at">{fmtDateTime(p.closure.verifiedAt)}</Field><Field label="Area clean">{p.closure.areaClean ? "Yes" : "No"}</Field><Field label="Work complete">{p.closure.workComplete ? "Yes" : "No"}</Field></>}
              </dl>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Approval trail">
            {p.approvals.length === 0 && <p className="text-muted">Approvers are set when the permit is submitted.</p>}
            <ul className="space-y-3">
              {p.approvals.map((a) => (
                <li key={a.id} className="rounded-sm border-2 border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-semibold uppercase">{ROLE_LABEL[a.requiredRole]}</span>
                    <span className={`inline-flex items-center gap-1 rounded-sm px-2 text-sm font-semibold ${a.status === "APPROVED" ? "bg-go text-white" : a.status === "REJECTED" ? "bg-stop text-white" : "border-2 border-dashed border-muted"}`}>
                      {a.status === "APPROVED" ? <Check size={14} /> : a.status === "REJECTED" ? <X size={14} /> : <Clock size={14} />} {humanize(a.status)}
                    </span>
                  </div>
                  {a.approver && <p className="text-sm">{a.approver.name} · {fmtDateTime(a.decidedAt)}</p>}
                  {a.comment && <p className="mt-1 text-base">“{a.comment}”</p>}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="History"><AuditTimeline permitId={p.id} version={`${p.status}-${p.updatedAt}`} /></Card>
        </div>
      </div>
    </div>
  );
}
