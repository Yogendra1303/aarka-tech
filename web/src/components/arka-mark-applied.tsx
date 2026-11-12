"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = { n?: string; url?: string; company?: string; role?: string; location?: string; source?: string; compact?: boolean; current?: string; block?: boolean };
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// "Mark already applied": you applied on the employer's site; this only records it.
export function MarkAppliedButton({ n, url, company, role, location, source, compact = false, current, block = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ n: string; created: boolean; previousStatus: string | null } | null>(null);
  const [err, setErr] = useState("");
  const already = /^applied$/i.test(current || "");

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/arka/applied", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n, url, company, role, location, source, date, note }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setDone(j); setOpen(false);
      startTransition(() => router.refresh());
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const undo = async () => {
    if (!done) return;
    setBusy(true); setErr("");
    try {
      const r = done.created
        ? await fetch("/api/tracker/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: done.n }) })
        : await fetch("/api/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: done.n, status: done.previousStatus || "Evaluated" }) });
      if (!r.ok) throw new Error((await r.json()).error || "Could not undo.");
      setDone(null);
      startTransition(() => router.refresh());
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const btn = cn("inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors disabled:opacity-50 max-sm:min-h-[44px]", compact ? "h-8 px-2.5 text-xs" : "min-h-9 px-3 text-sm");
  if (done) return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-md bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700 dark:text-emerald-300">Marked applied{done.created ? ` · added as #${done.n}` : ""}</span>
      <button type="button" onClick={undo} disabled={busy} className="inline-flex items-center gap-1 font-semibold text-brand-text hover:underline"><Undo2 className="size-3" /> Undo</button>
      {err && <span role="alert" className="text-red-600 dark:text-red-400">{err}</span>}
    </span>
  );
  if (already && !open) return null; // the status control already says Applied
  return (
    <span className={cn("relative", block ? "flex" : "inline-flex")}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn(btn, "border-border text-foreground hover:border-brand/40", block && "w-full")}>
        <CalendarCheck className="size-3.5" /> {compact ? "Mark applied" : "Mark already applied"}
      </button>
      {open && (
        <span className="absolute right-0 top-full z-30 mt-1 w-72 max-w-[85vw] rounded-xl border border-border bg-surface p-3 text-left shadow-lg">
          <span className="block text-xs text-muted">Records that you applied yourself on the employer&apos;s site. Nothing is sent.</span>
          <label className="mt-2 block text-xs font-semibold text-muted">Applied on
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="mt-1 min-h-9 w-full rounded-lg border border-border bg-background/40 px-2 text-sm text-foreground" />
          </label>
          <label className="mt-2 block text-xs font-semibold text-muted">Note (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. referral from Priya" className="mt-1 min-h-9 w-full rounded-lg border border-border bg-background/40 px-2 text-sm text-foreground" />
          </label>
          {err && <span role="alert" className="mt-2 block text-xs text-red-600 dark:text-red-400">{err}</span>}
          <span className="mt-3 flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground disabled:opacity-50">{busy && <Loader2 className="size-3.5 animate-spin" />} Save</button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-9 rounded-lg border border-border px-3 text-sm text-muted">Cancel</button>
          </span>
        </span>
      )}
    </span>
  );
}
