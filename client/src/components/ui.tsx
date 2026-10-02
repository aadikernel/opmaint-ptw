import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect } from "react";
import { ApiError } from "../api/client";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "danger" | "ghost" | "hazard" | "go" };
const VARIANT = {
  primary: "bg-ink text-white hover:bg-[#2b333a] border-ink",
  danger: "bg-stop text-white hover:bg-[#a31f25] border-stop",
  go: "bg-go text-white hover:bg-[#156a3a] border-go",
  hazard: "bg-hazard text-ink hover:bg-[#e0b200] border-ink",
  ghost: "bg-white text-ink hover:bg-steel border-line",
};
export function Button({ variant = "primary", className = "", ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border-2 px-4 font-display text-lg font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    />
  );
}

export function Card({ title, children, className = "", right }: { title?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`rounded-sm border border-line bg-panel ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-xl font-semibold uppercase tracking-wide">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const inputCls = "min-h-11 w-full rounded-sm border-2 border-line bg-white px-3 py-2 text-base focus:border-ink";

export function Label({ text, hint, children }: { text: string; hint?: string; children: ReactNode }) {
  // The control is nested inside the <label>, so screen readers and taps on the text focus it.
  return (
    <label className="block">
      <span className="mb-1 block text-base font-medium">{text}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}
export const TextInput = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} ${p.className ?? ""}`} />;
export const TextArea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={`${inputCls} ${p.className ?? ""}`} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${inputCls} ${p.className ?? ""}`} />;

export function Banner({ kind = "error", children }: { kind?: "error" | "warn" | "ok" | "info"; children: ReactNode }) {
  const style = {
    error: "border-stop bg-[#fbe9ea] text-[#7d1519]", warn: "border-ink bg-hazard/30 text-ink",
    ok: "border-go bg-[#e3f3ea] text-[#0f4a28]", info: "border-info bg-[#dce9f7] text-[#143f70]",
  }[kind];
  const Icon = kind === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex gap-2 rounded-sm border-l-8 p-3 ${style}`}>
      <Icon size={20} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 text-base">{children}</div>
    </div>
  );
}

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error as ApiError;
  return (
    <Banner>
      <p className="font-semibold">{e.message}</p>
      {e.details && e.details.length > 1 && (
        <ul className="mt-1 list-disc pl-5 text-sm">{e.details.map((d, i) => <li key={i}>{d.message}</li>)}</ul>
      )}
    </Banner>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-md bg-white sm:max-w-lg sm:rounded-sm">
        <div className="hazard-stripe h-2" />
        <header className="flex items-center justify-between px-4 py-3">
          <h2 className="text-2xl font-semibold uppercase">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-sm hover:bg-steel"><X /></button>
        </header>
        <div className="space-y-4 px-4 pb-5">{children}</div>
      </div>
    </div>
  );
}
