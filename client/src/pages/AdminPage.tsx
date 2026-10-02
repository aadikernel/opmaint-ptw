import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { Banner, Button, Card, ErrorBanner, Label, Select, TextInput } from "../components/ui";
import { ROLE_LABEL } from "../lib/format";
import type { Locations, Role } from "../lib/types";

interface AdminUser { id: string; name: string; email: string; role: Role; areaId: string | null; active: boolean }

/** Minimal admin screen: manage users, plants, areas and equipment (all enforced ADMIN-only on the server). */
export function AdminPage() {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => api<{ users: AdminUser[] }>("/admin/users") });
  const locs = useQuery({ queryKey: ["locations"], queryFn: () => api<Locations>("/reference/locations") });
  const areas = locs.data?.plants.flatMap((p) => p.areas.map((a) => ({ id: a.id, label: `${p.name} › ${a.name}` }))) ?? [];
  const [ok, setOk] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["locations"] }); };

  const send = useMutation({
    mutationFn: (v: { path: string; method?: string; body: unknown; msg: string }) => api(v.path, { method: v.method ?? "POST", body: v.body }).then(() => v.msg),
    onSuccess: (msg) => { setOk(msg); refresh(); },
    onMutate: () => setOk(""),
  });

  const [u, setU] = useState({ name: "", email: "", password: "", role: "REQUESTER", areaId: "" });
  const [plant, setPlant] = useState({ name: "", code: "" });
  const [area, setArea] = useState({ name: "", plantId: "" });
  const [eq, setEq] = useState({ tag: "", name: "", areaId: "" });

  return (
    <div className="space-y-4">
      <h1 className="text-4xl font-bold uppercase">Admin</h1>
      <ErrorBanner error={send.error} />
      {ok && <Banner kind="ok">{ok}</Banner>}
      <Card title="Users">
        <ul className="mb-4 divide-y divide-line rounded-sm border border-line">
          {users.data?.users.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span><b>{x.name}</b> · {x.email} · {ROLE_LABEL[x.role]}{!x.active && " · disabled"}</span>
              <Button variant="ghost" className="min-h-9 text-base" onClick={() => send.mutate({ path: `/admin/users/${x.id}`, method: "PATCH", body: { active: !x.active }, msg: `${x.name} ${x.active ? "disabled" : "enabled"}.` })}>{x.active ? "Disable" : "Enable"}</Button>
            </li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-3">
          <Label text="Name"><TextInput value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} /></Label>
          <Label text="Email"><TextInput type="email" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} /></Label>
          <Label text="Password (8+ characters)"><TextInput type="password" value={u.password} onChange={(e) => setU({ ...u, password: e.target.value })} /></Label>
          <Label text="Role"><Select value={u.role} onChange={(e) => setU({ ...u, role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Label>
          <Label text="Area (for Area Owners)"><Select value={u.areaId} onChange={(e) => setU({ ...u, areaId: e.target.value })}><option value="">None</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select></Label>
          <div className="flex items-end"><Button onClick={() => send.mutate({ path: "/admin/users", body: { ...u, areaId: u.areaId || null }, msg: "User created." })}>Add user</Button></div>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Add plant">
          <div className="space-y-3"><Label text="Name"><TextInput value={plant.name} onChange={(e) => setPlant({ ...plant, name: e.target.value })} /></Label><Label text="Code"><TextInput value={plant.code} onChange={(e) => setPlant({ ...plant, code: e.target.value })} /></Label>
            <Button onClick={() => send.mutate({ path: "/admin/plants", body: plant, msg: "Plant added." })}>Add plant</Button></div>
        </Card>
        <Card title="Add area">
          <div className="space-y-3"><Label text="Name"><TextInput value={area.name} onChange={(e) => setArea({ ...area, name: e.target.value })} /></Label>
            <Label text="Plant"><Select value={area.plantId} onChange={(e) => setArea({ ...area, plantId: e.target.value })}><option value="">Select…</option>{locs.data?.plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Label>
            <Button onClick={() => send.mutate({ path: "/admin/areas", body: area, msg: "Area added." })}>Add area</Button></div>
        </Card>
        <Card title="Add equipment">
          <div className="space-y-3"><Label text="Tag"><TextInput value={eq.tag} onChange={(e) => setEq({ ...eq, tag: e.target.value })} /></Label><Label text="Name"><TextInput value={eq.name} onChange={(e) => setEq({ ...eq, name: e.target.value })} /></Label>
            <Label text="Area"><Select value={eq.areaId} onChange={(e) => setEq({ ...eq, areaId: e.target.value })}><option value="">Select…</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select></Label>
            <Button onClick={() => send.mutate({ path: "/admin/equipment", body: eq, msg: "Equipment added." })}>Add equipment</Button></div>
        </Card>
      </div>
    </div>
  );
}
