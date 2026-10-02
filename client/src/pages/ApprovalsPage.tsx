import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Banner, Card, ErrorBanner } from "../components/ui";
import { PermitRow } from "../components/PermitRow";
import type { Permit } from "../lib/types";

export function ApprovalsPage() {
  const q = useQuery({ queryKey: ["permits", "approvals"], queryFn: () => api<{ permits: Permit[] }>("/permits?pendingMyApproval=true"), refetchInterval: 30_000 });
  return (
    <Card title="Waiting for your approval">
      <p className="mb-3 text-muted">Open a permit to review the work, location, hazards, PPE, precautions and safety readings, then approve or reject it.</p>
      <ErrorBanner error={q.error} />
      <div className="space-y-2">
        {q.data?.permits.map((p) => <PermitRow key={p.id} p={p} showApprovalHint />)}
        {q.data && q.data.permits.length === 0 && <Banner kind="ok">Nothing is waiting for you.</Banner>}
      </div>
    </Card>
  );
}
