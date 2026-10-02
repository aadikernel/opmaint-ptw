import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";
import type { Permit, WorkLog } from "../../lib/types";
import { fmtDateTime } from "../../lib/format";
import { Banner, Button, ErrorBanner, Label, Select, TextInput } from "../ui";

/** Work and entry/exit log. The server only accepts entries while the permit is ACTIVE (Rule 5). */
export function WorkLogPanel({ permit }: { permit: Permit }) {
  const qc = useQueryClient();
  const logs = useQuery({ queryKey: ["worklogs", permit.id], queryFn: () => api<{ workLogs: WorkLog[] }>(`/permits/${permit.id}/work-logs`) });
  const [kind, setKind] = useState<"NOTE" | "ENTRY" | "EXIT">("NOTE");
  const [person, setPerson] = useState("");
  const [note, setNote] = useState("");
  const add = useMutation({
    mutationFn: () => api(`/permits/${permit.id}/work-logs`, { method: "POST", body: { kind, personName: person || undefined, note } }),
    onSuccess: () => { setNote(""); setPerson(""); qc.invalidateQueries({ queryKey: ["worklogs", permit.id] }); },
  });
  const isCS = permit.permitType === "CONFINED_SPACE";
  return (
    <div className="space-y-3">
      {permit.status !== "ACTIVE" && <Banner kind="warn">Work can only be logged while the permit is ACTIVE.</Banner>}
      <ul className="divide-y divide-line rounded-sm border border-line">
        {logs.data?.workLogs.map((l) => (
          <li key={l.id} className="px-3 py-2">
            <div className="text-sm text-muted">{fmtDateTime(l.loggedAt)} · {l.user.name}</div>
            <div>{l.kind !== "NOTE" && <b className="mr-2 rounded-sm bg-ink px-1.5 text-sm text-white">{l.kind === "ENTRY" ? "ENTERED" : "EXITED"}{l.personName ? `: ${l.personName}` : ""}</b>}{l.note}</div>
          </li>
        ))}
        {logs.data?.workLogs.length === 0 && <li className="px-3 py-2 text-muted">No work logged yet.</li>}
      </ul>
      {permit.allowedActions.includes("logWork") && (
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end">
          {isCS ? <Label text="Type"><Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="NOTE">Note</option><option value="ENTRY">Entry</option><option value="EXIT">Exit</option></Select></Label> : <div />}
          {kind !== "NOTE" ? <Label text="Person"><TextInput value={person} onChange={(e) => setPerson(e.target.value)} /></Label> : <div />}
          <Label text="Note"><TextInput value={note} onChange={(e) => setNote(e.target.value)} /></Label>
          <Button disabled={note.trim().length < 2 || add.isPending || (kind !== "NOTE" && !person.trim())} onClick={() => add.mutate()}>Log work</Button>
        </div>
      )}
      <ErrorBanner error={add.error} />
    </div>
  );
}
