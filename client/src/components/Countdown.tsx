import { AlarmClock } from "lucide-react";
import { remaining } from "../lib/format";
import { useNow } from "../lib/useNow";

/** Live time-left display for ACTIVE permits. Turns into a loud warning inside the last 2 hours. */
export function Countdown({ end, className = "" }: { end: string | null; className?: string }) {
  const now = useNow(1000);
  const r = remaining(end, now);
  if (!r) return <span className={`font-display font-semibold text-stop ${className}`}>Window ended</span>;
  const soon = r.ms <= 2 * 3600_000;
  return (
    <span className={`inline-flex items-center gap-1 font-display font-semibold tabular-nums ${soon ? "text-stop" : "text-ink"} ${className}`}>
      <AlarmClock size={16} aria-hidden /> {soon && "Expires in "}{r.text}{!soon && " left"}
    </span>
  );
}
