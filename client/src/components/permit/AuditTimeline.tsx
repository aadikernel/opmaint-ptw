import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { api } from "../../api/client";
import type { AuditEntry } from "../../lib/types";
import { fmtDateTime, humanize, STATUS_LABEL } from "../../lib/format";
import { StatusBadge } from "../StatusBadge";

const VERB: Record<string, string> = {
  CREATED: "Created the permit", SUBMITTED: "Submitted the permit for approval", APPROVED: "Approved the permit",
  REJECTED: "Rejected the permit", ACTIVATED: "Activated the permit", SUSPENDED: "Suspended the permit",
  RESUMED: "Resumed the permit", WORK_COMPLETED: "Marked work complete", CLOSURE_VERIFIED: "Verified closure",
  CANCELLED: "Cancelled the permit", EXPIRED: "Permit expired automatically", FIELDS_EDITED: "Edited permit fields",
};

const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") || "none" : typeof v === "object" && v !== null ? "updated" : String(v ?? "none"));

export function AuditTimeline({ permitId, version }: { permitId: string; version: string }) {
  const q = useQuery({ queryKey: ["audit", permitId, version], queryFn: () => api<{ entries: AuditEntry[] }>(`/permits/${permitId}/audit`) });
  const entries = [...(q.data?.entries ?? [])].reverse();
  return (
    <ol className="relative space-y-4 border-l-4 border-ink pl-5">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[30px] top-1.5 size-3.5 rounded-full border-4 border-ink bg-hazard" aria-hidden />
          <div className="text-sm text-muted">{fmtDateTime(e.createdAt)}</div>
          <div className="text-lg font-semibold">{e.actorName}</div>
          <div className="text-base">{VERB[e.action] ?? humanize(e.action)}</div>
          {e.toStatus && e.fromStatus !== e.toStatus && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Status:</span>
              {e.fromStatus ? <StatusBadge status={e.fromStatus} /> : <span className="text-muted">new</span>}
              <ArrowRight size={14} aria-hidden /> <StatusBadge status={e.toStatus} />
            </div>
          )}
          {e.changes && Object.entries(e.changes).map(([k, c]) => (
            <div key={k} className="mt-1 text-sm"><span className="font-medium">{humanize(k)}:</span> {show(c.from)} <ArrowRight size={12} className="inline" aria-hidden /> {show(c.to)}</div>
          ))}
          {e.comment && <blockquote className="mt-1 border-l-4 border-line bg-steel/60 px-3 py-1 text-base">“{e.comment}”</blockquote>}
        </li>
      ))}
      {q.isLoading && <li className="text-muted">Loading history…</li>}
    </ol>
  );
}
