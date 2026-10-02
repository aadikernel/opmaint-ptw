import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import type { Permit } from "../lib/types";
import { fmtDateTime } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { Countdown } from "./Countdown";
import { typeRegistry } from "../permitTypes/registry";

export function PermitRow({ p, showApprovalHint = false }: { p: Permit; showApprovalHint?: boolean }) {
  const Icon = typeRegistry[p.permitType]?.Icon;
  const expiring = p.status === "ACTIVE" && p.plannedEnd && new Date(p.plannedEnd).getTime() - Date.now() <= 2 * 3600_000;
  const edge = p.status === "ACTIVE" ? (expiring ? "border-l-stop" : "border-l-go") : p.status === "SUSPENDED" ? "border-l-hazard" : p.status === "EXPIRED" ? "border-l-stop" : "border-l-line";
  return (
    <Link to={`/permits/${p.id}`} className={`block rounded-sm border border-line border-l-8 bg-white p-3 hover:bg-[#f4f6f8] ${edge}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={20} aria-hidden />}
          <span className="font-display text-xl font-bold">{p.displayNumber}</span>
          <span className="font-medium">{p.typeLabel}</span>
          {p.risk === "HIGH" && <span className="rounded-sm bg-ink px-1.5 text-sm font-semibold text-hazard">High risk</span>}
        </div>
        <StatusBadge status={p.status} />
      </div>
      <p className="mt-1 line-clamp-2 text-base">{p.workDescription || <span className="text-muted">No description yet</span>}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden />{p.location ? `${p.location.plant.name} › ${p.location.area.name} › ${p.location.equipment.tag}` : "No location yet"}</span>
        <span>{fmtDateTime(p.plannedStart)} → {fmtDateTime(p.plannedEnd)}</span>
        <span>By {p.requester.name}</span>
        {p.status === "ACTIVE" && <Countdown end={p.plannedEnd} />}
        {showApprovalHint && p.allowedActions.includes("approve") && <span className="font-semibold text-info">Your approval needed</span>}
      </div>
    </Link>
  );
}
