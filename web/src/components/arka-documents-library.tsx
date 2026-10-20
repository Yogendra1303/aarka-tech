"use client";

import { useCallback, useEffect, useState } from "react";
import { ArkaRecordsVault } from "@/components/arka-records-vault";
import Link from "next/link";
import { Download, Eye, FileText, Loader2, Pencil } from "lucide-react";

type Doc = { id: string; kind: string; label: string; date: string; size: number; archived: boolean; usedFor?: string | null; employer?: string; role?: string };
const KIND: Record<string, string> = { original: "Original upload", master: "Master resume", "tailored-resume": "Tailored resume", "cover-letter": "Cover letter" };
const btn = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition hover:border-brand/50 disabled:opacity-50";

// Documents: the one place for resume versions, cover letters and application-pack files.
export function ArkaDocumentsLibrary() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [section, setSection] = useState<"apps" | "records">("apps");
  const [showArchived, setShowArchived] = useState(false);
  const [rename, setRename] = useState<{ id: string; label: string } | null>(null);
  const load = useCallback(async () => {
    try { const r = await fetch("/api/arka/hub", { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setDocs(j.library); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const patch = async (id: string, body: Record<string, unknown>) => {
    const r = await fetch("/api/arka/hub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "doc", id, ...body }) });
    if (!r.ok) setErr((await r.json()).error); await load();
  };
  const list = (docs || []).filter((d) => (showArchived || !d.archived) && (filter === "all" || d.kind === filter));
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 max-sm:px-4 max-sm:pb-24">
      <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-foreground">Documents</h1>
      <p className="mt-1 text-sm text-muted">Every resume version, cover letter and original upload, labelled by job and date. Versions are generated from your one master profile in <Link href="/profile" className="font-semibold text-brand-text hover:underline">My Career Hub</Link>.</p>
      <div className="mt-4 inline-flex rounded-xl border border-border bg-surface/50 p-1" role="group" aria-label="Document area">
        {([["apps", "Application documents"], ["records", "Personal records"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setSection(k)} aria-pressed={section === k} className={`min-h-9 rounded-lg px-4 text-sm font-semibold ${section === k ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground"}`}>{l}</button>
        ))}
      </div>
      {section === "records" ? <ArkaRecordsVault /> : <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {[["all", "All"], ["tailored-resume", "Tailored resumes"], ["cover-letter", "Cover letters"], ["master", "Master"], ["original", "Originals"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={`min-h-8 rounded-lg border px-3 text-xs font-semibold ${filter === k ? "border-brand/60 bg-brand-soft text-brand-text" : "border-border text-muted hover:text-foreground"}`}>{l}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[#EC5E27]" /> Show archived</label>
      </div>
      {err && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}
      {!docs ? <p className="mt-6 flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Loading documents…</p> : list.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">No documents here yet. Upload a resume in My Career Hub, then prepare an application pack from Applications.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
          {list.map((d) => (
            <li key={d.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${d.archived ? "opacity-60" : ""}`}>
              <FileText className="size-4 shrink-0 text-brand-text" />
              <div className="min-w-0 flex-1">
                {rename?.id === d.id ? (
                  <span className="flex gap-2"><input aria-label="New name" className="min-h-9 w-full rounded-lg border border-border bg-background/40 px-3 text-sm" value={rename.label} onChange={(e) => setRename({ id: d.id, label: e.target.value })} /><button className={btn} onClick={async () => { await patch(d.id, { label: rename.label }); setRename(null); }}>Save</button></span>
                ) : <span className="block truncate text-sm font-semibold text-foreground">{d.label}</span>}
                <span className="block text-xs text-faint">{KIND[d.kind] || d.kind} · {new Date(d.date).toLocaleDateString("en-IN")} · {Math.round(d.size / 1024)} KB{d.usedFor ? ` · linked to application ${d.usedFor}` : ""}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <a className={btn} href={`/api/arka/hub?doc=${d.id}`} target="_blank" rel="noreferrer"><Eye className="size-3.5" /> Preview</a>
                <a className={btn} href={`/api/arka/hub?doc=${d.id}&download=1`}><Download className="size-3.5" /> Download</a>
                <button className={btn} aria-label={`Rename ${d.label}`} onClick={() => setRename({ id: d.id, label: d.label })}><Pencil className="size-3.5" /></button>
                <button className={btn} onClick={() => patch(d.id, { archived: !d.archived })}>{d.archived ? "Restore" : "Archive"}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-faint">Archiving hides a version here; the file is kept. &quot;Linked to application&quot; shows the tracker entry the version belongs to; submission is only recorded when you mark it in Applications.</p>
      </>}
    </div>
  );
}
