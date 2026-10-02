import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, ClipboardCheck, Pause, Pencil, Play, ShieldCheck, ThumbsDown, ThumbsUp, Send, Zap } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { Permit } from "../../lib/types";
import { Banner, Button, ErrorBanner, Label, Modal, TextArea } from "../ui";

type Dialog = null | "approve" | "reject" | "suspend" | "resume" | "complete" | "verify" | "cancel";

/**
 * Renders ONLY the actions the server listed in `allowedActions`.
 * (The server still re-checks every request: hiding a button is a convenience, not security.)
 */
export function ActionPanel({ permit }: { permit: Permit }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState("");
  const [areaClean, setAreaClean] = useState(false);
  const [workComplete, setWorkComplete] = useState(false);
  const a = (x: string) => permit.allowedActions.includes(x);

  const run = useMutation({
    mutationFn: (v: { path: string; body?: unknown }) => api(`/permits/${permit.id}/${v.path}`, { method: "POST", body: v.body ?? {} }),
    onSuccess: () => { setDialog(null); setText(""); qc.invalidateQueries(); },
  });
  const close = () => { setDialog(null); setText(""); run.reset(); };

  const blocked = permit.blockers.length > 0;
  const simple = (path: string) => run.mutate({ path });

  const none = permit.allowedActions.filter((x) => x !== "logWork").length === 0;

  return (
    <div className="space-y-3">
      {none && <p className="text-muted">No actions are available to you on this permit right now.</p>}
      {!dialog && <ErrorBanner error={run.error} />}
      <div className="flex flex-wrap gap-2">
        {a("edit") && <Button variant="ghost" onClick={() => nav(`/permits/${permit.id}/edit`)}><Pencil size={18} /> Edit draft</Button>}
        {a("submit") && <Button variant="go" disabled={run.isPending} onClick={() => simple("submit")}><Send size={18} /> Submit for approval</Button>}
        {a("approve") && <Button variant="go" onClick={() => setDialog("approve")}><ThumbsUp size={18} /> Approve</Button>}
        {a("reject") && <Button variant="danger" onClick={() => setDialog("reject")}><ThumbsDown size={18} /> Reject</Button>}
        {a("activate") && <Button variant="go" disabled={run.isPending} onClick={() => simple("activate")}><Zap size={18} /> Activate permit</Button>}
        {a("suspend") && <Button variant="hazard" onClick={() => setDialog("suspend")}><Pause size={18} /> Suspend: stop work</Button>}
        {a("resume") && <Button variant="go" onClick={() => setDialog("resume")}><Play size={18} /> Resume</Button>}
        {a("complete") && <Button onClick={() => setDialog("complete")}><CheckCircle2 size={18} /> Mark work complete</Button>}
        {a("verify") && <Button onClick={() => setDialog("verify")}><ShieldCheck size={18} /> Verify closure</Button>}
        {a("cancel") && <Button variant="ghost" onClick={() => setDialog("cancel")}><Ban size={18} /> Cancel permit</Button>}
      </div>
      {(a("activate") || a("resume")) && blocked && (
        <Banner kind="warn">
          <p className="font-semibold">Right now the server will refuse this because:</p>
          <ul className="list-disc pl-5">{permit.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        </Banner>
      )}

      {dialog === "approve" && (
        <Modal title="Approve permit" onClose={close}>
          <Label text="Comment (optional)"><TextArea value={text} onChange={(e) => setText(e.target.value)} /></Label>
          <ErrorBanner error={run.error} />
          <Button variant="go" className="w-full" disabled={run.isPending} onClick={() => run.mutate({ path: "approve", body: { comment: text || undefined } })}><ThumbsUp size={18} /> Confirm approval</Button>
        </Modal>
      )}
      {dialog === "reject" && (
        <Modal title="Reject permit" onClose={close}>
          <Label text="Reason for rejection (required)" hint="The requester will see this reason."><TextArea value={text} onChange={(e) => setText(e.target.value)} /></Label>
          <ErrorBanner error={run.error} />
          <Button variant="danger" className="w-full" disabled={text.trim().length < 3 || run.isPending} onClick={() => run.mutate({ path: "reject", body: { reason: text } })}><ThumbsDown size={18} /> Reject permit</Button>
        </Modal>
      )}
      {dialog === "suspend" && (
        <Modal title="Suspend permit" onClose={close}>
          <Banner kind="warn">Suspending stops work immediately. Nothing can be logged until the permit is resumed.</Banner>
          <Label text="Reason (required)"><TextArea value={text} onChange={(e) => setText(e.target.value)} /></Label>
          <ErrorBanner error={run.error} />
          <Button variant="hazard" className="w-full" disabled={text.trim().length < 3 || run.isPending} onClick={() => run.mutate({ path: "suspend", body: { reason: text } })}><Pause size={18} /> Suspend now</Button>
        </Modal>
      )}
      {dialog === "resume" && (
        <Modal title="Resume permit" onClose={close}>
          <p>The server re-checks approvals, the validity window and the safety readings before work can restart.</p>
          <Label text="Comment (optional)"><TextArea value={text} onChange={(e) => setText(e.target.value)} /></Label>
          <ErrorBanner error={run.error} />
          <Button variant="go" className="w-full" disabled={run.isPending} onClick={() => run.mutate({ path: "resume", body: { comment: text || undefined } })}><Play size={18} /> Resume work</Button>
        </Modal>
      )}
      {dialog === "complete" && (
        <Modal title="Mark work complete" onClose={close}>
          <Label text="Completion notes (required)" hint="What was done? Is the area handed back clean?"><TextArea value={text} onChange={(e) => setText(e.target.value)} /></Label>
          <ErrorBanner error={run.error} />
          <Button className="w-full" disabled={text.trim().length < 5 || run.isPending} onClick={() => run.mutate({ path: "complete", body: { completionNotes: text } })}><CheckCircle2 size={18} /> Submit for closure check</Button>
        </Modal>
      )}
      {dialog === "verify" && (
        <Modal title="Verify closure" onClose={close}>
          <p className="rounded-sm bg-steel p-3"><b>Requester's notes:</b> {permit.completionNotes}</p>
          {[["Area is clean and safe", areaClean, setAreaClean], ["Work is complete", workComplete, setWorkComplete]].map(([label, val, setter]) => (
            <label key={label as string} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border-2 border-line px-3">
              <input type="checkbox" className="size-5" checked={val as boolean} onChange={(e) => (setter as (b: boolean) => void)(e.target.checked)} /> {label as string}
            </label>
          ))}
          <Label text="Comment (optional)"><TextArea value={text} onChange={(e) => setText(e.target.value)} /></Label>
          <ErrorBanner error={run.error} />
          <Button className="w-full" disabled={!areaClean || !workComplete || run.isPending} onClick={() => run.mutate({ path: "verify-closure", body: { areaClean, workComplete, comment: text || undefined } })}><ClipboardCheck size={18} /> Verify and close</Button>
        </Modal>
      )}
      {dialog === "cancel" && (
        <Modal title="Cancel permit" onClose={close}>
          <Banner kind="warn">Cancelling is final. A cancelled permit cannot be used again.</Banner>
          <Label text="Reason (required)"><TextArea value={text} onChange={(e) => setText(e.target.value)} /></Label>
          <ErrorBanner error={run.error} />
          <Button variant="danger" className="w-full" disabled={text.trim().length < 3 || run.isPending} onClick={() => run.mutate({ path: "cancel", body: { reason: text } })}><Ban size={18} /> Cancel permit</Button>
        </Modal>
      )}
    </div>
  );
}
