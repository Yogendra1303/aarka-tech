"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, Loader2, Lock, LockOpen, ShieldCheck, Trash2, Upload } from "lucide-react";

type Item = { id: string; name: string; category: string; label: string; note: string; size: number; ext: string; addedAt: string; docDate: string };
type Status = { ready: boolean; items: Item[]; categories: string[] };
const btn = "inline-flex min-h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted hover:text-foreground";
const AUTO_LOCK_MS = 5 * 60 * 1000;

// Private records: encrypted on this Mac, key in Keychain, outside the Career-ops folder.
// Never read by application packs or AI. The list stays locked until asked for, and locks
// again after five idle minutes or when the tab is hidden.
export function ArkaRecordsVault() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState("all");
  const [form, setForm] = useState({ category: "Salary slips", label: "", docDate: "", note: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => { setOpen(false); setS(null); }, []);
  const touch = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(lock, AUTO_LOCK_MS); }, [lock]);
  const load = useCallback(async () => {
    const r = await fetch("/api/arka/vault", { cache: "no-store" });
    const j = await r.json();
    if (r.ok) { setS(j); setErr(null); } else setErr(j.error);
  }, []);
  useEffect(() => {
    if (!open) return;
    void load(); touch();
    const hide = () => { if (document.hidden) lock(); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); if (timer.current) clearTimeout(timer.current); };
  }, [open, load, lock, touch]);

  const upload = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) { setErr("Choose a file first."); return; }
    setBusy(true); setErr(null); touch();
    const fd = new FormData(); fd.set("file", f);
    for (const [k, v] of Object.entries(form)) fd.set(k, v);
    const r = await fetch("/api/arka/vault", { method: "POST", body: fd });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error); return; }
    if (fileRef.current) fileRef.current.value = "";
    setForm({ ...form, label: "", note: "", docDate: "" });
    await load();
  };
  const remove = async (it: Item) => {
    if (!window.confirm(`Delete "${it.label}" from the vault? The encrypted file is removed from this Mac and cannot be recovered.`)) return;
    touch();
    const r = await fetch("/api/arka/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: it.id }) });
    if (!r.ok) setErr((await r.json()).error); await load();
  };

  const field = "min-h-9 w-full rounded-lg border border-border bg-background/40 px-3 text-sm text-foreground";
  const items = (s?.items || []).filter((i) => cat === "all" || i.category === cat);
  const counts = new Map<string, number>(); for (const i of s?.items || []) counts.set(i.category, (counts.get(i.category) || 0) + 1);

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-5 max-sm:p-4" onPointerDown={open ? touch : undefined}>
      <div className="flex flex-wrap items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-text" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">Personal records</h2>
          <p className="mt-0.5 text-sm text-muted">Salary slips, Aadhaar, PAN, offer and relieving letters, Form 16 and other records you want in one place.</p>
          <ul className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
            <li>Encrypted on this Mac (AES-256); the key is kept in your macOS Keychain.</li>
            <li>Stored outside the Career-ops folder, so never in git or backups of it.</li>
            <li>Never sent to an AI provider and never added to an application pack.</li>
            <li>Locks after 5 idle minutes or when you leave this tab.</li>
          </ul>
        </div>
        {open
          ? <button type="button" className={btn} onClick={lock}><Lock className="size-3.5" /> Lock</button>
          : <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground"><LockOpen className="size-4" /> Open records</button>}
      </div>

      {open && (
        !s ? <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Opening…</p> : (
          <>
            <div className="mt-4 grid gap-3 rounded-xl border border-dashed border-border p-3 md:grid-cols-[1.2fr_1fr_0.8fr]">
              <label className="text-xs font-semibold text-muted">Type
                <select className={`${field} mt-1`} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{s.categories.map((c) => <option key={c}>{c}</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-muted">Name (optional)
                <input className={`${field} mt-1`} placeholder="e.g. March payslip" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </label>
              <label className="text-xs font-semibold text-muted">Month
                <input type="month" className={`${field} mt-1`} value={form.docDate} onChange={(e) => setForm({ ...form, docDate: e.target.value })} />
              </label>
              <label className="text-xs font-semibold text-muted md:col-span-2">Note (optional)
                <input className={`${field} mt-1`} placeholder="Anything you want to remember about it" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
              <div className="flex items-end gap-2">
                <input ref={fileRef} type="file" aria-label="Record file" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt" className="min-w-0 flex-1 text-xs text-muted file:mr-2 file:rounded-md file:border file:border-border file:bg-surface file:px-2 file:py-1 file:text-xs" />
                <button type="button" disabled={busy} onClick={upload} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-foreground disabled:opacity-50">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Add</button>
              </div>
            </div>
            {err && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}

            <div className="mt-4 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setCat("all")} aria-pressed={cat === "all"} className={`min-h-8 rounded-lg border px-3 text-xs font-semibold ${cat === "all" ? "border-brand/60 bg-brand-soft text-brand-text" : "border-border text-muted"}`}>All {s.items.length}</button>
              {s.categories.filter((c) => counts.get(c)).map((c) => (
                <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={`min-h-8 rounded-lg border px-3 text-xs font-semibold ${cat === c ? "border-brand/60 bg-brand-soft text-brand-text" : "border-border text-muted"}`}>{c.split(" (")[0]} {counts.get(c)}</button>
              ))}
            </div>
            {items.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">No records yet. Add your first one above.</p> : (
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                {items.map((it) => (
                  <li key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Lock className="size-4 shrink-0 text-faint" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{it.label}</span>
                      <span className="block text-xs text-faint">{it.category.split(" (")[0]}{it.docDate ? ` · ${it.docDate}` : ""} · {it.ext.toUpperCase()} · {Math.max(1, Math.round(it.size / 1024))} KB · added {new Date(it.addedAt).toLocaleDateString("en-IN")}{it.note ? ` · ${it.note}` : ""}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <a className={btn} href={`/api/arka/vault?id=${it.id}`} target="_blank" rel="noreferrer" onClick={touch}><Eye className="size-3.5" /> View</a>
                      <a className={btn} href={`/api/arka/vault?id=${it.id}&download=1`} onClick={touch}><Download className="size-3.5" /></a>
                      <button type="button" className={btn} aria-label={`Delete ${it.label}`} onClick={() => remove(it)}><Trash2 className="size-3.5" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      )}
    </section>
  );
}
