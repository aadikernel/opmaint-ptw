import { useQuery } from "@tanstack/react-query";
import { AlarmClock, CircleDot, ClipboardCheck, FileEdit, PauseCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Banner, Button, Card, ErrorBanner, Label, Select, TextInput } from "../components/ui";
import { PermitRow } from "../components/PermitRow";
import { Countdown } from "../components/Countdown";
import { Link } from "react-router-dom";
import type { Locations, Permit, Stats } from "../lib/types";
import { STATUS_LABEL } from "../lib/format";

interface Filters { status: string; type: string; areaId: string; from: string; to: string; pendingMyApproval: boolean; expiringSoon: boolean; search: string }
const EMPTY: Filters = { status: "", type: "", areaId: "", from: "", to: "", pendingMyApproval: false, expiringSoon: false, search: "" };

function qs(f: Partial<Filters>) {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.type) p.set("type", f.type);
  if (f.areaId) p.set("areaId", f.areaId);
  if (f.from) p.set("from", new Date(f.from).toISOString());
  if (f.to) p.set("to", new Date(f.to + "T23:59:59").toISOString());
  if (f.pendingMyApproval) p.set("pendingMyApproval", "true");
  if (f.expiringSoon) p.set("expiringSoon", "true");
  if (f.search) p.set("search", f.search);
  return p.toString();
}

export function DashboardPage() {
  const { user } = useAuth();
  const [f, setF] = useState<Filters>(EMPTY);
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/permits/stats"), refetchInterval: 30_000 });
  const live = useQuery({ queryKey: ["permits", "live"], queryFn: () => api<{ permits: Permit[] }>("/permits?activeNow=true"), refetchInterval: 30_000 });
  const list = useQuery({ queryKey: ["permits", f], queryFn: () => api<{ permits: Permit[] }>(`/permits?${qs(f)}`), refetchInterval: 30_000 });
  const locations = useQuery({ queryKey: ["locations"], queryFn: () => api<Locations>("/reference/locations") });

  const areas = locations.data?.plants.flatMap((p) => p.areas.map((a) => ({ id: a.id, label: `${p.name} › ${a.name}` }))) ?? [];
  const canApprove = user!.role !== "REQUESTER";
  const apply = (patch: Partial<Filters>) => setF({ ...EMPTY, ...patch });
  const s = stats.data;

  const soonList = (live.data?.permits ?? []).filter((p) => p.plannedEnd && new Date(p.plannedEnd).getTime() - Date.now() <= 2 * 3600_000);

  const cards: { key: string; label: string; n: number | undefined; Icon: typeof CircleDot; tone: string; patch: Partial<Filters> }[] = [
    { key: "active", label: "Active now", n: s?.active, Icon: CircleDot, tone: "border-go bg-go text-white", patch: { status: "ACTIVE" } },
    { key: "soon", label: "Expiring in 2 h", n: s?.expiringSoon, Icon: AlarmClock, tone: "border-stop bg-white text-stop", patch: { expiringSoon: true } },
    { key: "pending", label: "Pending approval", n: s?.pendingApproval, Icon: ClipboardCheck, tone: "border-info bg-white text-info", patch: { status: "PENDING_APPROVAL" } },
    { key: "susp", label: "Suspended", n: s?.suspended, Icon: PauseCircle, tone: "border-ink bg-hazard text-ink", patch: { status: "SUSPENDED" } },
    { key: "draft", label: "Drafts", n: s?.draft, Icon: FileEdit, tone: "border-muted bg-white text-ink", patch: { status: "DRAFT" } },
    { key: "closed", label: "Closed, last 7 days", n: s?.recentlyClosed, Icon: ShieldCheck, tone: "border-ink bg-white text-ink", patch: { status: "CLOSED,CLOSED_VERIFIED" } },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map(({ key, label, n, Icon, tone, patch }) => (
          <button key={key} onClick={() => apply(patch)} className={`rounded-sm border-2 p-3 text-left ${tone} ${key === "soon" && (n ?? 0) > 0 ? "ring-4 ring-stop/30" : ""}`}>
            <div className="flex items-center justify-between"><Icon size={22} aria-hidden /><span className="font-display text-5xl font-bold leading-none tabular-nums">{n ?? "–"}</span></div>
            <div className="mt-2 font-display text-lg font-semibold uppercase leading-tight">{label}</div>
          </button>
        ))}
      </div>

      {soonList.length > 0 && (
        <div className="rounded-sm border-2 border-stop bg-white">
          <div className="flex items-center gap-2 bg-stop px-3 py-2 text-white"><AlarmClock size={20} /><h2 className="text-xl font-semibold uppercase">Expiring within 2 hours: close out or request a new permit</h2></div>
          <ul className="divide-y divide-line">
            {soonList.map((p) => (
              <li key={p.id}><Link to={`/permits/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-steel">
                <span><b className="font-display text-lg">{p.displayNumber}</b> {p.typeLabel} · {p.location?.equipment.tag}</span>
                <Countdown end={p.plannedEnd} className="text-lg" />
              </Link></li>
            ))}
          </ul>
        </div>
      )}

      {(live.data?.permits.length ?? 0) > 0 && (
        <Card title={`Active right now (${live.data!.permits.length})`}>
          <div className="grid gap-2 lg:grid-cols-2">{live.data!.permits.map((p) => <PermitRow key={p.id} p={p} />)}</div>
        </Card>
      )}

      <Card title="All permits" right={<span className="text-sm text-muted">{list.data ? `${list.data.permits.length} shown` : ""}</span>}>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Label text="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select></Label>
          <Label text="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="">All types</option>
            <option value="HOT_WORK">Hot work</option><option value="CONFINED_SPACE">Confined space</option>
            <option value="WORKING_AT_HEIGHT">Working at height</option><option value="ELECTRICAL_LOTO">Electrical / LOTO</option>
          </Select></Label>
          <Label text="Area"><Select value={f.areaId} onChange={(e) => setF({ ...f, areaId: e.target.value })}>
            <option value="">All areas</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </Select></Label>
          <Label text="From date"><TextInput type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Label>
          <Label text="To date"><TextInput type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Label>
          <Label text="Search"><TextInput placeholder="Number, tag, contractor…" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} /></Label>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {canApprove && (
            <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border-2 px-3 font-medium ${f.pendingMyApproval ? "border-info bg-info text-white" : "border-line bg-white"}`}>
              <input type="checkbox" className="size-5" checked={f.pendingMyApproval} onChange={(e) => setF({ ...f, pendingMyApproval: e.target.checked })} />
              My approvals pending {s ? `(${s.myApprovalsPending})` : ""}
            </label>
          )}
          <Button variant="ghost" onClick={() => setF(EMPTY)}>Clear filters</Button>
        </div>
        <ErrorBanner error={list.error} />
        <div className="space-y-2">
          {list.data?.permits.map((p) => <PermitRow key={p.id} p={p} showApprovalHint />)}
          {list.data && list.data.permits.length === 0 && <Banner kind="info">No permits match these filters.</Banner>}
          {list.isLoading && <p className="text-muted">Loading permits…</p>}
        </div>
      </Card>
    </div>
  );
}
