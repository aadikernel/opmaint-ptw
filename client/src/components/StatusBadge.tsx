import { Ban, CheckCheck, CircleDot, Clock, FileEdit, Hourglass, PauseCircle, ShieldCheck, ThumbsUp, XOctagon } from "lucide-react";
import type { PermitStatus } from "../lib/types";
import { STATUS_LABEL } from "../lib/format";

// Every status has a distinct ICON, a text label and a colour treatment (never colour alone).
const STYLE: Record<PermitStatus, { cls: string; Icon: typeof Clock }> = {
  DRAFT: { cls: "bg-white text-ink border-2 border-dashed border-muted", Icon: FileEdit },
  PENDING_APPROVAL: { cls: "bg-[#dce9f7] text-info border-2 border-info", Icon: Hourglass },
  APPROVED: { cls: "bg-white text-go border-2 border-go", Icon: ThumbsUp },
  ACTIVE: { cls: "bg-go text-white border-2 border-go", Icon: CircleDot },
  SUSPENDED: { cls: "bg-hazard text-ink border-2 border-ink", Icon: PauseCircle },
  EXPIRED: { cls: "bg-stop text-white border-2 border-stop", Icon: Clock },
  REJECTED: { cls: "bg-white text-stop border-2 border-stop", Icon: XOctagon },
  CLOSED: { cls: "bg-[#d5d9dd] text-ink border-2 border-muted", Icon: CheckCheck },
  CLOSED_VERIFIED: { cls: "bg-ink text-white border-2 border-ink", Icon: ShieldCheck },
  CANCELLED: { cls: "bg-[#d5d9dd] text-muted border-2 border-muted line-through", Icon: Ban },
};

export function StatusBadge({ status, large = false }: { status: PermitStatus; large?: boolean }) {
  const { cls, Icon } = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm font-display font-semibold uppercase tracking-wide whitespace-nowrap ${large ? "px-3 py-1.5 text-lg" : "px-2 py-0.5 text-sm"} ${cls}`}>
      <Icon size={large ? 20 : 15} aria-hidden /> {STATUS_LABEL[status]}
    </span>
  );
}
