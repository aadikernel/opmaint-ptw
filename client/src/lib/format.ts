import type { PermitStatus, Role } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  REQUESTER: "Requester", AREA_OWNER: "Area Owner", SAFETY_OFFICER: "Safety Officer", ADMIN: "Admin",
};
export const STATUS_LABEL: Record<PermitStatus, string> = {
  DRAFT: "Draft", PENDING_APPROVAL: "Pending approval", APPROVED: "Approved", ACTIVE: "Active", SUSPENDED: "Suspended",
  EXPIRED: "Expired", REJECTED: "Rejected", CLOSED: "Closed", CLOSED_VERIFIED: "Closed & verified", CANCELLED: "Cancelled",
};

const dtf = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const tf = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (iso?: string | null) => (iso ? dtf.format(new Date(iso)) : "—");
export const fmtTime = (iso: string) => tf.format(new Date(iso));

/** "1h 29m" / "12m" / "40s". Negative values return null (already past). */
export function remaining(endIso: string | null, now: number): { text: string; ms: number } | null {
  if (!endIso) return null;
  const ms = new Date(endIso).getTime() - now;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  const text = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
  return { text, ms };
}

export const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const humanize = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// Small helpers to read/write nested values by "a.b.c" path
export const getIn = (obj: any, path: string) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
export function setIn(obj: Record<string, any>, path: string, value: unknown) {
  const keys = path.split(".");
  const out = { ...obj };
  let cur: any = out;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value;
    else { cur[k] = { ...(cur[k] ?? {}) }; cur = cur[k]; }
  });
  return out;
}
