"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ClipboardPaste, ExternalLink, FileText, Link2, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { MarkAppliedButton } from "@/components/arka-mark-applied";
import { cn } from "@/lib/cn";

type Draft = { url: string; company: string; title: string; location: string; employmentType: string; salary: string; requirements: string[]; description: string; source: string; fetchedVia: string; fetchedAt: string | null };
type Dup = { where: string; label: string; n?: string; id?: string };
type Saved = Draft & { id: string; savedAt: string; jdFile: string; tracked: { n: string; status: string; score: string } | null };

const field = "mt-1 min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-faint focus:border-brand/60";
const btn = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:border-brand/40 disabled:opacity-50 max-sm:min-h-[44px]";
const primary = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground disabled:opacity-50";

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/arka/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: "The server sent an unreadable reply." }));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

// Add a Job: paste a link (or the description), check what was read, save it, then use the
// usual tools on it. Also the in-app details view for jobs found in Explore.
export function ArkaAddJob() {
  const sp = useSearchParams();
  const { startJob } = useJobs();
  const [url, setUrl] = useState(sp.get("url") || "");
  const [paste, setPaste] = useState({ open: false, text: "", company: "", title: "", location: "" });
  const [phase, setPhase] = useState<"idle" | "reading" | "preview" | "saving" | "saved">("idle");
  const [err, setErr] = useState<{ text: string; retry?: () => void } | null>(null);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const original = useRef<Draft | null>(null);
  const [dups, setDups] = useState<Dup[]>([]);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [list, setList] = useState<Saved[] | null>(null);

  const loadList = useCallback(() => fetch("/api/arka/jobs", { cache: "no-store" }).then((r) => r.json()).then((j) => setList(j.jobs || [])).catch(() => setList([])), []);
  useEffect(() => { void loadList(); }, [loadList]);

  const show = (r: { draft?: Draft; duplicates?: Dup[] }) => { setDraft(r.draft!); original.current = r.draft!; setDups(r.duplicates || []); setPhase("preview"); };
  const analyze = useCallback(async (target = url) => {
    setErr(null); setNotice(""); setSaved(null); setPhase("reading");
    try {
      const r = await post({ action: "analyze", url: target });
      if (r.error) { setErr({ text: r.error }); setPhase("idle"); return; }
      if (r.needsPaste) { setNotice(r.reason); setDups(r.duplicates || []); setPaste((p) => ({ ...p, open: true })); setPhase("idle"); return; }
      show(r);
    } catch (e) { setErr({ text: (e as Error).message, retry: () => void analyze(target) }); setPhase("idle"); }
  }, [url]);
  const auto = useRef(false);
  useEffect(() => { if (!auto.current && sp.get("url")) { auto.current = true; void analyze(sp.get("url")!); } }, [sp, analyze]);

  const readPasted = async () => {
    setErr(null);
    try { const r = await post({ action: "paste", ...paste, url }); if (r.error) setErr({ text: r.error }); else show(r); }
    catch (e) { setErr({ text: (e as Error).message }); }
  };
  const save = async () => {
    if (!draft) return;
    setPhase("saving"); setErr(null);
    const edited = original.current ? (Object.keys(draft) as (keyof Draft)[]).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(original.current![k])) : [];
    try { const r = await post({ action: "save", draft: { ...draft, edited } }); setSaved({ ...r.job, tracked: null }); setPhase("saved"); void loadList(); }
    catch (e) { setErr({ text: (e as Error).message, retry: save }); setPhase("preview"); }
  };
  const evaluate = (j: Saved | Draft & { jdFile?: string }) => startJob({
    title: `Evaluate · ${j.company}`, subtitle: j.title, kind: "evaluate", page: "/add-job",
    input: j.url || (j as Saved).jdFile,
  });
  const set = (k: keyof Draft, v: string | string[]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const inApps = dups.find((d) => d.where === "applications");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 max-sm:px-4 max-sm:pb-24">
      <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-foreground">Add a Job</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">Paste a job link from anywhere. Aarka Tech reads the posting, shows you what it found, and saves it once you confirm. You always apply on the employer&apos;s own site.</p>

      <section className="mt-5 rounded-2xl border border-border bg-surface p-4">
        <form onSubmit={(e) => { e.preventDefault(); void analyze(); }} className="flex flex-wrap gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Job link</span>
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… link to the job posting" inputMode="url" className={cn(field, "mt-0 pl-9")} />
          </label>
          <button type="submit" disabled={!url.trim() || phase === "reading"} className={primary}>{phase === "reading" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {phase === "reading" ? "Reading…" : "Read posting"}</button>
        </form>
        <p className="mt-2 text-xs text-faint">Pages that need a sign-in (LinkedIn, Naukri and similar), CAPTCHAs or paywalls are never bypassed. For those, paste the description.</p>
        <button type="button" onClick={() => setPaste((p) => ({ ...p, open: !p.open }))} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline"><ClipboardPaste className="size-4" /> {paste.open ? "Hide paste box" : "Paste the description instead"}</button>
        {paste.open && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-muted sm:col-span-3">Job description
              <textarea value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} rows={8} placeholder="Paste the full job description here" className={cn(field, "py-2")} />
            </label>
            {(["company", "title", "location"] as const).map((k) => (
              <label key={k} className="text-xs font-semibold capitalize text-muted">{k === "company" ? "Employer" : k === "title" ? "Job title" : "Location"} (optional)
                <input value={paste[k]} onChange={(e) => setPaste({ ...paste, [k]: e.target.value })} className={field} />
              </label>
            ))}
            <div className="sm:col-span-3"><button type="button" onClick={readPasted} disabled={paste.text.trim().length < 50} className={primary}>Read description</button></div>
          </div>
        )}
        {notice && <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{notice}</p>}
        {err && (
          <p role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {err.text}{err.retry && <button type="button" onClick={err.retry} className="inline-flex items-center gap-1 font-semibold underline"><RotateCcw className="size-3.5" /> Try again</button>}
          </p>
        )}
      </section>

      {dups.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-surface-hover/50 px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">You already have this job</p>
          <ul className="mt-1 space-y-1 text-muted">
            {dups.map((d) => <li key={d.where}>In {d.where}: {d.label} {d.n && <Link href={`/pipeline/${d.n}`} className="font-semibold text-brand-text hover:underline">Open</Link>}</li>)}
          </ul>
        </div>
      )}

      {draft && phase !== "saved" && (
        <section className="mt-4 rounded-2xl border border-border bg-surface p-4" aria-label="Check before saving">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold tracking-tight text-foreground">Check what was found</h2>
            <span className="rounded-md bg-surface-hover px-2 py-0.5 text-xs text-muted">{draft.source === "manual_url" ? `Read from the link (${draft.fetchedVia.replace("ats-api:", "")})` : "From your pasted text"}</span>
          </div>
          <p className="mt-0.5 text-xs text-faint">Only what the posting states is filled in. Empty means the posting doesn&apos;t say.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([["company", "Employer"], ["title", "Job title"], ["location", "Location"], ["employmentType", "Employment type"], ["salary", "Salary (as stated)"], ["url", "Job link"]] as const).map(([k, l]) => (
              <label key={k} className="text-xs font-semibold text-muted">{l}
                <input value={draft[k]} onChange={(e) => set(k, e.target.value)} placeholder="Not stated" className={field} />
              </label>
            ))}
            <label className="text-xs font-semibold text-muted sm:col-span-2">Requirements found ({draft.requirements.length}) · one per line
              <textarea value={draft.requirements.join("\n")} onChange={(e) => set("requirements", e.target.value.split("\n"))} rows={Math.min(8, Math.max(3, draft.requirements.length))} className={cn(field, "py-2")} />
            </label>
            <details className="sm:col-span-2 rounded-lg border border-border">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted">Full job description ({draft.description.length.toLocaleString()} characters)</summary>
              <textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={12} className={cn(field, "mt-0 rounded-none border-0 border-t py-2 font-mono text-xs")} />
            </details>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {inApps ? <Link href={`/pipeline/${inApps.n}`} className={primary}>Open it in Applications</Link>
              : <button type="button" onClick={save} disabled={phase === "saving"} className={primary}>{phase === "saving" && <Loader2 className="size-4 animate-spin" />} Save job</button>}
            {draft.url && <a href={draft.url} target="_blank" rel="noreferrer" className={btn}>Open original posting <ExternalLink className="size-3.5" /></a>}
            {!inApps && <MarkAppliedButton url={draft.url || undefined} company={draft.company} role={draft.title} location={draft.location} source={draft.source} />}
          </div>
        </section>
      )}

      {saved && <NextSteps job={saved} onEvaluate={() => evaluate(saved)} />}

      <section className="mt-8" aria-label="Jobs you added">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-faint">Jobs you added</h2>
        {list === null ? <p className="mt-2 flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>
          : list.length === 0 ? <p className="mt-2 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted">Nothing added yet.</p>
          : (
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
              {list.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <FileText className="size-4 shrink-0 text-brand-text" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{j.company} · {j.title}</p>
                    <p className="text-xs text-faint">{[j.location, j.source === "manual_url" ? "from a link" : "pasted", new Date(j.savedAt).toLocaleDateString("en-IN"), j.tracked ? `${j.tracked.status}${j.tracked.score && j.tracked.score !== "N/A" ? ` · ${j.tracked.score}` : ""}` : "not evaluated"].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {j.tracked ? <Link href={`/pipeline/${j.tracked.n}`} className={btn}>Open</Link> : <button type="button" onClick={() => evaluate(j)} className={btn}>Evaluate fit</button>}
                    {j.url && <a href={j.url} target="_blank" rel="noreferrer" aria-label={`Open the posting for ${j.title}`} className={btn}><ExternalLink className="size-3.5" /></a>}
                    <button type="button" aria-label={`Remove ${j.title} from this list`} onClick={async () => { if (!window.confirm("Remove this job from your added jobs? Its saved description stays in data/jds.")) return; await post({ action: "remove", id: j.id }); void loadList(); }} className={btn}><Trash2 className="size-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}

function NextSteps({ job, onEvaluate }: { job: Saved; onEvaluate: () => void }) {
  const step = "rounded-xl border border-border bg-surface p-3";
  return (
    <section className="mt-4 rounded-2xl border border-brand/30 bg-brand-soft/30 p-4" aria-label="Next steps">
      <h2 className="text-lg font-extrabold tracking-tight text-foreground">Saved. What next?</h2>
      <p className="mt-0.5 text-sm text-muted">{job.company} · {job.title}{job.url ? " · also in New postings" : ""}</p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <li className={step}><p className="text-sm font-semibold text-foreground">1. Evaluate fit</p><p className="text-xs text-muted">Uses your AI provider. Gives the fit score, gaps and a verdict.</p><button type="button" onClick={onEvaluate} className={cn(btn, "mt-2")}>Evaluate fit</button></li>
        <li className={step}><p className="text-sm font-semibold text-foreground">2. Tailored resume, cover letter, answers</p><p className="text-xs text-muted">Available on the evaluation page once it finishes, built from your verified profile.</p></li>
        <li className={step}><p className="text-sm font-semibold text-foreground">3. Apply on the employer&apos;s site</p><p className="text-xs text-muted">Then record it here. Nothing is sent by Aarka Tech.</p>
          <div className="mt-2 flex flex-wrap gap-2">{job.url && <a href={job.url} target="_blank" rel="noreferrer" className={btn}>Open posting <ExternalLink className="size-3.5" /></a>}<MarkAppliedButton url={job.url || undefined} company={job.company} role={job.title} location={job.location} source={job.source} /></div></li>
      </ol>
    </section>
  );
}
