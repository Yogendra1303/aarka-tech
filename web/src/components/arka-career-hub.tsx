"use client";

import { ArkaGmailCard } from "@/components/arka-gmail-card";
import { ResumeUploadButton } from "@/components/arka-resume-upload";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Briefcase, CheckCircle2, CircleDashed, Download, ExternalLink, Eye, FileText, Lightbulb, Link2, Loader2, Pencil, Plus, Upload, UserRound } from "lucide-react";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Hub = {
  overview: { name: string; headline: string; headlineEdited: boolean; summary: string; summarySource: string; experience: { label: string; basis: string }; current: string | null; expertise: string[]; targets: string[]; locations: string };
  completion: number; checks: { id: string; label: string; done: boolean; detail: string; href?: string }[];
  preferences: Record<string, string>; openQuestions: { id: string; issue: string; question: string | null }[];
  employment: Rec[]; consulting: Rec[]; projects: Rec[]; initiatives: Rec[]; achievements: Rec[]; skills: Rec[];
  insights: { strengths: { name: string; how: string; examples: string[] }[]; differentiators: { text: string; how: string }[]; alignedRoles: { roles: string[]; how: string }; reportGaps: { gap: string; job: string }[]; toolsWithoutEvidence: string[] };
  library: { id: string; path: string; kind: string; label: string; date: string; size: number; archived: boolean; usedFor?: string | null }[];
  assets: { id: string; name: string; visibility: string; project?: string; added: string; size: number; archived?: boolean }[];
  integrations: { id: string; name: string; kind: string; contributes: string; url: string | null; saved: string | null; lastSync: string | null; repos: number | null; topRepos: { name: string; url: string; description: string | null; language: string | null }[] }[];
  resumeStatus: { masterUpdated: string | null; originals: number; tailored: number; covers: number };
  swot: { strengths: SwotItem[]; weaknesses: SwotItem[]; opportunities: SwotItem[]; threats: SwotItem[]; meta: { updated: string | null; profileVersion: string; jobs: number; jobRange: string; stale: boolean; staleWhy: string }; jobSpecific: { company: string; role: string; n: string; gaps: number }[] };
};
const TABS = [["overview", "Career overview"], ["experience", "Employment & projects"], ["assets", "Career assets"], ["insights", "Career intelligence"], ["checklist", "Checklist"], ["accounts", "Connected accounts"]] as const;
type Tab = (typeof TABS)[number][0];

const card = "rounded-xl border border-border bg-surface p-4";
const btn = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition hover:border-brand/50 disabled:opacity-50";
const primary = "inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-200 disabled:opacity-50";
const input = "mt-1 min-h-9 w-full rounded-lg border border-border bg-background/40 px-3 text-sm text-foreground placeholder:text-faint focus:border-brand/60";

export function ArkaCareerHub() {
  const [hub, setHub] = useState<Hub | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const load = useCallback(async () => {
    try { const r = await fetch("/api/arka/hub", { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setHub(j); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); const t = new URLSearchParams(location.search).get("tab"); if (t && TABS.some(([k]) => k === t)) setTab(t as Tab); }, [load]);
  const post = async (body: Rec, ok: string) => {
    setMsg(null);
    const r = await fetch("/api/arka/hub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json(); if (!r.ok) { setMsg({ tone: "err", text: j.error }); return false; }
    setMsg({ tone: "ok", text: ok }); await load(); return true;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 max-sm:px-4 max-sm:pb-24">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">My Career Hub</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-[-0.03em] text-foreground"><UserRound className="size-6 text-brand-text" /> {hub?.overview.name || "Your career profile"}</h1>
        <ResumeUploadButton className={primary} onDone={(text) => { setMsg({ tone: "ok", text }); void load(); }} />
      </div>
      <div role="tablist" aria-label="Career Hub sections" className="mt-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setMsg(null); history.replaceState(null, "", `?tab=${k}`); }}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition ${tab === k ? "border-brand text-brand-text" : "border-transparent text-muted hover:text-foreground"}`}>{label}</button>
        ))}
      </div>
      {err && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{err}</p>}
      {msg && <p role="status" className={`mt-4 rounded-lg border px-3 py-2 text-sm ${msg.tone === "err" ? "border-red-500/40 text-red-600 dark:text-red-400" : "border-brand/40 text-foreground"}`}>{msg.text}</p>}
      {!hub ? <p className="mt-6 flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Loading your career records…</p> : (
        <div className="mt-5">
          {tab === "overview" && <Overview hub={hub} post={post} goTo={setTab} />}
          {tab === "assets" && <Assets hub={hub} post={post} reload={load} setMsg={setMsg} />}
          {tab === "experience" && <Experience hub={hub} post={post} />}
          {tab === "insights" && <Insights hub={hub} />}
          {tab === "checklist" && <Checklist hub={hub} reload={load} goTo={setTab} />}
          {tab === "accounts" && <Accounts hub={hub} reload={load} />}
        </div>
      )}
    </div>
  );
}

function Overview({ hub, post, goTo }: { hub: Hub; post: (b: Rec, ok: string) => Promise<boolean>; goTo: (t: Tab) => void }) {
  const o = hub.overview;
  const [edit, setEdit] = useState(false);
  const [headline, setHeadline] = useState(o.headline); const [summary, setSummary] = useState(o.summary);
  const missing = hub.checks.filter((c) => !c.done && c.id !== "linkedin_export");
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className={card}>
        {edit ? (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-muted">Headline<input className={input} value={headline} onChange={(e) => setHeadline(e.target.value)} /></label>
            <label className="block text-xs font-semibold text-muted">Summary<textarea rows={6} className={`${input} py-2`} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
            <div className="flex gap-2">
              <button className={primary} onClick={async () => { if (await post({ action: "overview", headline, summary }, "Overview saved. Your resume file (cv.md) is unchanged.")) setEdit(false); }}>Save</button>
              <button className={btn} onClick={() => setEdit(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-extrabold leading-snug text-foreground">{o.headline || "Add a headline"}</h2>
              <button className={btn} onClick={() => setEdit(true)}><Pencil className="size-3.5" /> Edit</button>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{o.summary || "No summary yet."}</p>
            <p className="mt-1 text-xs text-faint">Summary {o.summarySource}.</p>
          </>
        )}
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-faint">Professional experience</dt><dd className="font-semibold text-foreground">{o.experience.label}</dd><dd className="text-xs text-faint">{o.experience.basis}</dd></div>
          <div><dt className="text-xs text-faint">Current status</dt><dd className="font-semibold text-foreground">{o.current || "Not recorded"}</dd></div>
          <div><dt className="text-xs text-faint">Main expertise (by evidence)</dt><dd className="text-foreground">{o.expertise.join(", ") || "—"}</dd></div>
          <div><dt className="text-xs text-faint">Preferred roles</dt><dd className="text-foreground">{o.targets.join(", ") || "Not set"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-faint">Preferred locations</dt><dd className="text-foreground">{o.locations || "Not set"}</dd></div>
        </dl>
      </section>
      <section className={card}>
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-foreground">Profile completeness</h2><span className="text-2xl font-extrabold tabular-nums text-brand-text">{hub.completion}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hover"><div className="h-full rounded-full bg-brand" style={{ width: `${hub.completion}%` }} /></div>
        <h3 className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-faint">Most important missing</h3>
        <ul className="mt-2 space-y-1.5 text-sm">{missing.slice(0, 5).map((c) => <li key={c.id} className="flex gap-2"><CircleDashed className="mt-0.5 size-4 shrink-0 text-faint" /><span><span className="font-semibold text-foreground">{c.label}</span><span className="block text-xs text-muted">{c.detail}</span></span></li>)}</ul>
        <button className={`${btn} mt-3`} onClick={() => goTo("checklist")}>Open checklist</button>
      </section>
    </div>
  );
}

function Assets({ hub, post, reload, setMsg }: { hub: Hub; post: (b: Rec, ok: string) => Promise<boolean>; reload: () => Promise<void>; setMsg: (m: { tone: "ok" | "err"; text: string } | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [vis, setVis] = useState("private"); const [project, setProject] = useState(""); const [busy, setBusy] = useState(false);
  const rs = hub.resumeStatus;
  const upload = async (f: File) => {
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.append("file", f); fd.append("kind", "asset"); fd.append("visibility", vis); fd.append("project", project);
    const r = await fetch("/api/arka/hub", { method: "POST", body: fd }); const j = await r.json(); setBusy(false);
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    setMsg({ tone: "ok", text: `Added ${j.asset.name} as ${j.asset.visibility.replace("-", " ")}.` }); setProject(""); await reload();
  };
  const visLabel: Record<string, string> = { private: "Private (only you)", confidential: "Confidential (never shared)", "public-portfolio": "OK for public portfolio" };
  return (
    <div className="space-y-4">
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">Master resume</h2>
            <p className="text-xs text-muted">{rs.masterUpdated ? `Your career profile resume was last updated ${new Date(rs.masterUpdated).toLocaleDateString("en-IN")}.` : "No master resume yet."} {rs.originals} original upload(s), {rs.tailored} tailored version(s), {rs.covers} cover letter(s).</p>
          </div>
          <div className="flex gap-2">
            <ResumeUploadButton className={primary} label="Upload or replace resume" onDone={(text) => { setMsg({ tone: "ok", text }); void reload(); }} />
            <Link href="/documents" className={btn}><FileText className="size-3.5" /> Manage versions in Documents</Link>
          </div>
        </div>
      </section>
      <section className={card}>
        <h2 className="text-sm font-bold text-foreground">Portfolio and project files</h2>
        <p className="text-xs text-muted">Work samples, case studies, presentations or screenshots. Choose who may see each file; confidential files are never attached to applications.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-muted">Who may see it<select className={input} value={vis} onChange={(e) => setVis(e.target.value)}>{Object.entries(visLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="min-w-[200px] flex-1 text-xs font-semibold text-muted">Related project (optional)<input className={input} value={project} onChange={(e) => setProject(e.target.value)} placeholder="e.g. Fruitoo dashboard" list="hub-projects" /></label>
          <datalist id="hub-projects">{hub.projects.map((p) => <option key={String(p.id)} value={String(p.name || p.client)} />)}</datalist>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.webp,.zip" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button className={primary} disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Add file</button>
        </div>
        {hub.assets.filter((a) => !a.archived).length === 0 ? <p className="mt-3 text-sm text-muted">No portfolio files yet.</p> : (
          <ul className="mt-3 divide-y divide-border">{hub.assets.filter((a) => !a.archived).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <FileText className="size-4 shrink-0 text-brand-text" />
              <div className="min-w-0 flex-1"><span className="block truncate font-semibold text-foreground">{a.name}</span><span className="text-xs text-faint">{a.project || "no project linked"} · {Math.round(a.size / 1024)} KB · added {new Date(a.added).toLocaleDateString("en-IN")}</span></div>
              <select aria-label={`Visibility of ${a.name}`} className="min-h-9 rounded-lg border border-border bg-background/40 px-2 text-xs" value={a.visibility} onChange={(e) => post({ action: "asset", id: a.id, patch: { visibility: e.target.value } }, "Visibility updated.")}>{Object.entries(visLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <a className={btn} href={`/api/arka/hub?asset=${a.id}`} target="_blank" rel="noreferrer"><Eye className="size-3.5" /> Open</a>
              <button className={btn} onClick={() => { if (window.confirm(`Remove ${a.name} from your assets? The file stays in Documents/portfolio.`)) post({ action: "asset", id: a.id, patch: { archived: true } }, "Removed from assets (file kept)."); }}>Remove</button>
            </li>
          ))}</ul>
        )}
      </section>
      <section className={card}>
        <h2 className="text-sm font-bold text-foreground">Published work and links</h2>
        <p className="text-xs text-muted">Add your website, GitHub, Behance or other portfolio links in <span className="font-semibold text-foreground">Connected accounts</span>. They are links, not sign-ins.</p>
      </section>
    </div>
  );
}

const EMPTY = { name: "", client: "", type: "client project", role: "", start_text: "", end_text: "", description: "", contribution: "", deliverables: "", outcomes: "", technologies: "", skills: "", confidentiality: "unknown", status: "unverified", include_in_resumes: false, public_link: "" };
function Experience({ hub, post }: { hub: Hub; post: (b: Rec, ok: string) => Promise<boolean> }) {
  const [form, setForm] = useState<Rec | null>(null);
  const f = (k: string, label: string, area = false) => (
    <label className="block text-xs font-semibold text-muted">{label}
      {area ? <textarea rows={2} className={`${input} py-2`} value={form?.[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        : <input className={input} value={form?.[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />}
    </label>
  );
  const asText = (v: unknown) => (Array.isArray(v) ? v.join("; ") : typeof v === "object" && v ? String((v as Rec).value ?? (v as Rec).note ?? "") : String(v ?? ""));
  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Briefcase className="size-4 text-brand-text" /> Employment history</h2>
        <ul className="mt-3 space-y-3">
          {hub.employment.map((e) => (
            <li key={e.id} className="text-sm">
              <span className="font-semibold text-foreground">{e.employer}</span> <span className="text-xs text-faint">· {e.relationship} · {e.start} to {e.end || "present"} · {e.status === "needs_confirmation" ? "needs confirmation" : e.status}</span>
              <ul className="mt-1 space-y-0.5 pl-4 text-xs text-muted">{e.positions.map((p: Rec, i: number) => <li key={i}>{p.title} ({p.start || "?"} – {p.end || "?"}){p.variants?.length ? <span className="text-amber-600 dark:text-amber-400"> · other titles in older resumes: {p.variants.join(", ")}</span> : null}</li>)}</ul>
            </li>
          ))}
          {hub.consulting.map((c) => <li key={c.id} className="text-sm"><span className="font-semibold text-foreground">{c.name}</span> <span className="text-xs text-faint">· {c.role} · since {c.start} · overlaps other work (allowed)</span></li>)}
        </ul>
      </section>
      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground">Projects & client engagements ({hub.projects.length})</h2>
          <button className={btn} onClick={() => setForm({ ...EMPTY })}><Plus className="size-3.5" /> Add project</button>
        </div>
        {form && (
          <div className="mt-3 grid gap-3 rounded-lg border border-border bg-background/40 p-3 sm:grid-cols-2">
            {f("name", "Project name *")}{f("client", "Client or organisation")}{f("role", "Your role")}
            <label className="block text-xs font-semibold text-muted">Type<select className={input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{["client project", "independent consulting engagement", "internal initiative", "own business / product", "personal / portfolio project"].map((t) => <option key={t}>{t}</option>)}</select></label>
            {f("start_text", "Start (e.g. 2026-09, 2025, or unknown)")}{f("end_text", "End (or ongoing)")}
            <div className="sm:col-span-2">{f("description", "What it was", true)}</div>
            {f("contribution", "Your contribution", true)}{f("deliverables", "Deliverables", true)}
            {f("outcomes", "Outcomes / metrics (only what you can stand behind)", true)}{f("technologies", "Tools and technologies")}
            {f("skills", "Skills shown")}{f("public_link", "Public link (optional)")}
            <label className="block text-xs font-semibold text-muted">Confidentiality<select className={input} value={form.confidentiality} onChange={(e) => setForm({ ...form, confidentiality: e.target.value })}>{["unknown", "can be named", "anonymise client", "confidential — do not use"].map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="flex items-center gap-2 text-xs text-foreground"><input type="checkbox" checked={!!form.include_in_resumes} onChange={(e) => setForm({ ...form, include_in_resumes: e.target.checked })} className="accent-[#EC5E27]" /> Allow in tailored resumes when relevant</label>
            <div className="flex gap-2 sm:col-span-2">
              <button className={primary} onClick={async () => { if (await post({ action: "project", project: form }, "Project saved (marked needs confirmation until you verify it).")) setForm(null); }}>Save project</button>
              <button className={btn} onClick={() => setForm(null)}>Cancel</button>
            </div>
          </div>
        )}
        <ul className="mt-3 divide-y divide-border">
          {hub.projects.map((p) => (
            <li key={String(p.id)} className="flex flex-wrap items-start gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-foreground">{p.name || p.client}</span>
                <span className="block text-xs text-faint">{p.type} · {p.role || "role not set"} · {asText(p.start_text || p.start) || "dates unknown"}{p.end_text || (p.end && asText(p.end)) ? ` – ${asText(p.end_text || p.end)}` : ""} · {p.disclosure || p.confidentiality || "disclosure unknown"} · {p.origin}</span>
                {p.review_status === "needs_confirmation" && <span className="text-xs text-amber-600 dark:text-amber-400">Needs confirmation</span>}
              </div>
              <button className={btn} onClick={() => setForm({
                ...EMPTY, id: p.id, name: p.name || p.client, client: p.client || "", type: p.type || "client project", role: p.role || "",
                start_text: p.start_text || asText(p.start), end_text: p.end_text || asText(p.end), description: p.description || p.problem || "",
                contribution: p.contribution ? asText(p.contribution) : "", deliverables: asText(p.deliverables), outcomes: Array.isArray(p.results) ? p.results.map((r: Rec) => r.text).join("; ") : p.outcomes || "",
                technologies: asText(p.tools || p.technologies), skills: asText(p.skills), confidentiality: p.confidentiality || "unknown", include_in_resumes: !!p.include_in_resumes, public_link: p.public_link || "",
              })}><Pencil className="size-3.5" /> Edit</button>
            </li>
          ))}
        </ul>
      </section>
      <section className={card}>
        <h2 className="text-sm font-bold text-foreground">Achievements ({hub.achievements.length}) and skills ({hub.skills.length})</h2>
        <ul className="mt-2 space-y-1.5 text-xs text-muted">{hub.achievements.slice(0, 8).map((a) => <li key={a.id}><span className="text-foreground">{a.text}</span> <span className="text-faint">· {a.confidence}</span></li>)}</ul>
        <p className="mt-2 text-xs text-faint">Every achievement keeps its source document. Education: {hub.employment.length ? "Bachelor of Business Management, University of Mysore (2017)" : "—"}. Certifications: none recorded.</p>
      </section>
    </div>
  );
}

type SwotItem = { text: string; evidence: string; scope: string; inference?: boolean };
function Insights({ hub }: { hub: Hub }) {
  const w = hub.swot;
  const box = (title: string, sub: string, items: SwotItem[], tone: string, empty: string) => (
    <section className={card}>
      <h2 className={`text-sm font-bold ${tone}`}>{title}</h2>
      <p className="text-xs text-faint">{sub}</p>
      {items.length ? (
        <ul className="mt-2 space-y-2.5 text-sm">{items.map((x) => (
          <li key={x.text}>
            <span className="text-foreground">{x.text}</span>
            {x.inference && <span className="ml-1.5 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Inference</span>}
            <span className="block text-xs text-muted">{x.evidence}</span>
          </li>
        ))}</ul>
      ) : <p className="mt-2 text-sm text-muted">{empty}</p>}
    </section>
  );
  return (
    <div className="space-y-4">
      <p className="text-xs text-faint">
        Built from your career records{w.meta.jobs ? ` and ${w.meta.jobs} evaluated job${w.meta.jobs === 1 ? "" : "s"}${w.meta.jobRange ? ` (${w.meta.jobRange})` : ""}` : ""}. {w.meta.profileVersion}{w.meta.updated ? ` · records updated ${new Date(w.meta.updated).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}. No AI is used to compute this page.
        {w.meta.stale && <span className="mt-1 block font-semibold text-amber-700 dark:text-amber-300">{w.meta.staleWhy}</span>}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {box("Strengths", "Backed by achievements in your records.", w.strengths, "text-emerald-700 dark:text-emerald-300", "Add achievements with results to see strengths here.")}
        {box("Weaknesses", "Gaps in the evidence your profile gives, not skills you're assumed to lack.", w.weaknesses, "text-amber-700 dark:text-amber-300", "No evidence gaps found.")}
        {box("Opportunities", "Inferences from your profile and evaluated jobs, with the basis shown.", w.opportunities, "text-brand-text", "Evaluate a few jobs to see patterns.")}
        {box("Threats", "Only constraints that came up in two or more evaluated postings.", w.threats, "text-red-700 dark:text-red-300", w.meta.jobs < 2 ? "Needs at least two evaluated jobs." : "No constraint repeats across postings.")}
      </div>
      {w.jobSpecific.length > 0 && (
        <section className={card}>
          <h2 className="text-sm font-bold text-foreground">Gaps for a single job</h2>
          <p className="text-xs text-faint">These belong to one posting, not your whole career, so they live on that job&apos;s evaluation.</p>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">{w.jobSpecific.map((j) => <li key={j.n}><Link className={btn} href={`/pipeline/${j.n}`}>{j.company} · {j.role.slice(0, 40)} <span className="text-faint">{j.gaps} gaps</span></Link></li>)}</ul>
        </section>
      )}
    </div>
  );
}

type Check = Hub["checks"][number] & { state?: string; neededFor?: string; section?: string };
const STATE_TONE: Record<string, string> = { present: "border-emerald-500/30 text-emerald-700 dark:text-emerald-300", missing: "border-border text-muted", incomplete: "border-amber-500/40 text-amber-700 dark:text-amber-300", outdated: "border-amber-500/40 text-amber-700 dark:text-amber-300" };
const STATE_LABEL: Record<string, string> = { present: "Present", missing: "Missing", incomplete: "Incomplete", outdated: "May be outdated" };
const CURRENCIES = ["INR", "AED", "USD", "EUR", "GBP", "SGD", "SAR", "QAR", "AUD", "CAD"];

function Checklist({ hub, reload, goTo }: { hub: Hub; reload: () => Promise<void>; goTo: (t: Tab) => void }) {
  const [form, setForm] = useState<Record<string, string>>(hub.preferences);
  useEffect(() => { setForm(hub.preferences); }, [hub.preferences]);
  const [open, setOpen] = useState<string | null>(null);
  const [status, setStatus] = useState<{ id: string; tone: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState("all");
  const rows = useRef<Record<string, HTMLLIElement | null>>({});
  const order = ["resume", "contact", "linkedin", "history", "projects", "achievements", "skills", "education", "targets", "locations", "salary", "notice", "auth", "conflicts", "linkedin_export"];
  const items = ([...hub.checks] as Check[]).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const sections = [...new Set(items.map((c) => c.section).filter(Boolean))] as string[];
  const shown = section === "all" ? items : items.filter((c) => c.section === section);

  const save = async (id: string, keys: string[]) => {
    setSaving(true); setStatus(null);
    const body = Object.fromEntries(keys.map((k) => [k, form[k] ?? ""]));
    try {
      const r = await fetch("/api/arka/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not save.");
      setStatus({ id, tone: "ok", text: j.changed.length ? "Saved. Your profile, resumes and evaluations now use this (a backup of the old profile was kept)." : "Nothing changed." });
      await reload();
      setOpen(null);
      requestAnimationFrame(() => rows.current[id]?.scrollIntoView({ block: "nearest" }));
    } catch (e) { setStatus({ id, tone: "err", text: (e as Error).message }); }
    finally { setSaving(false); }
  };
  const fld = (k: string, label: string, ph = "", type = "text") => (
    <label className="block text-xs font-semibold text-muted">{label}
      <input className={input} type={type} value={form[k] || ""} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </label>
  );
  const editor = (c: Check) => {
    const saveBtn = (keys: string[]) => <button className={`${primary} mt-3`} disabled={saving} onClick={() => save(c.id, keys)}>{saving ? <Loader2 className="size-4 animate-spin" /> : null} Save</button>;
    switch (c.id) {
      case "resume": return <div className="flex flex-wrap items-center gap-2"><ResumeUploadButton className={primary} onDone={(text) => { setStatus({ id: c.id, tone: "ok", text }); void reload(); }} /><Link href="/cv" className={btn}>Edit resume text</Link></div>;
      case "contact": return <div className="grid gap-2 sm:grid-cols-3">{fld("email", "Email", "you@example.com", "email")}{fld("phone", "Phone", "+91 …", "tel")}{fld("location", "City, country", "Gurugram, India")}<div className="sm:col-span-3">{saveBtn(["email", "phone", "location"])}</div></div>;
      case "linkedin": return <div>{fld("linkedin", "LinkedIn profile URL", "linkedin.com/in/your-name")}{saveBtn(["linkedin"])}</div>;
      case "targets": return <div>{fld("target_roles", "Target roles (comma separated)", "Head of Operations, General Manager")}{saveBtn(["target_roles"])}</div>;
      case "locations": return <div>{fld("locations", "Where you'd work", "Gurugram / Delhi NCR preferred; open to Dubai")}{saveBtn(["locations"])}</div>;
      case "salary": return (
        <div>
          <div className="grid gap-2 sm:grid-cols-4">
            {fld("target_range", "Amount", "e.g. 45–55 lakh or 35,000")}
            <label className="block text-xs font-semibold text-muted">Currency
              <select className={input} value={form.currency || ""} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="">Choose…</option>{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="block text-xs font-semibold text-muted">Per
              <select className={input} value={form.salary_period || ""} onChange={(e) => setForm({ ...form, salary_period: e.target.value })}><option value="">Choose…</option><option value="year">year</option><option value="month">month</option><option value="hour">hour</option></select>
            </label>
            {fld("minimum", "Minimum (optional)", "Not set")}
          </div>
          <p className="mt-1 text-xs text-faint">Amount, currency and period are saved together so the number can't be misread.</p>
          {saveBtn(["target_range", "currency", "salary_period", "minimum"])}
        </div>
      );
      case "notice": return <div>{fld("notice_period_days", "Notice period in days", "e.g. 30", "number")}{saveBtn(["notice_period_days"])}</div>;
      case "auth": return <div>{fld("visa_status", "UAE work authorization", "e.g. needs employer visa sponsorship")}{saveBtn(["visa_status"])}</div>;
      case "history": case "projects": case "achievements": case "conflicts": return <button className={btn} onClick={() => goTo("experience")}>Open Employment &amp; projects</button>;
      case "skills": case "education": return <div className="flex flex-wrap gap-2"><Link href="/cv" className={btn}>Edit in your resume</Link><ResumeUploadButton className={btn} label="Upload a newer resume" onDone={(text) => { setStatus({ id: c.id, tone: "ok", text }); void reload(); }} /></div>;
      case "linkedin_export": return <button className={btn} onClick={() => goTo("accounts")}>Open Connected accounts</button>;
      default: return null;
    }
  };
  const counts = (st: string) => items.filter((c) => (c.state || (c.done ? "present" : "missing")) === st).length;

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground">Profile checklist</h2>
          <p className="text-xs text-muted">{counts("present")} present · {counts("missing")} missing · {counts("incomplete")} incomplete · {counts("outdated")} may be outdated. Blank fields stay blank; nothing is guessed.</p>
        </div>
        <label className="text-xs font-semibold text-muted">What do you want to update?
          <select className={`${input} mt-1 min-w-[12rem]`} value={section} onChange={(e) => { setSection(e.target.value); const first = items.find((c) => c.section === e.target.value); if (first) { setOpen(first.id); requestAnimationFrame(() => rows.current[first.id]?.scrollIntoView({ block: "center", behavior: "smooth" })); } }}>
            <option value="all">Everything</option>
            {sections.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {shown.map((c) => {
          const st = c.state || (c.done ? "present" : "missing");
          return (
            <li key={c.id} ref={(el) => { rows.current[c.id] = el; }} className="py-3">
              <div className="flex flex-wrap items-start gap-3">
                {st === "present" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-text" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-faint" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{c.label} <span className={`ml-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATE_TONE[st]}`}>{STATE_LABEL[st]}</span></p>
                  <p className="mt-0.5 break-words text-xs text-muted">{c.detail}</p>
                  <p className="text-[11px] text-faint">{c.neededFor ? `Needed for ${c.neededFor}` : "Optional"}</p>
                </div>
                <button className={btn} aria-expanded={open === c.id} onClick={() => { setOpen(open === c.id ? null : c.id); setStatus(null); }}><Pencil className="size-3" /> {open === c.id ? "Close" : st === "missing" ? "Add" : "Edit"}</button>
              </div>
              {open === c.id && <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">{editor(c)}</div>}
              {status?.id === c.id && (
                <p role="status" className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${status.tone === "err" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-300"}`}>
                  {status.text}{status.tone === "err" && <button className="font-semibold underline" onClick={() => setOpen(c.id)}>Try again</button>}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {hub.openQuestions.length > 0 && <><h3 className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-faint">Facts to confirm</h3><ul className="mt-2 space-y-1 text-xs text-foreground">{hub.openQuestions.map((q) => <li key={q.id}>{q.question || q.issue}</li>)}</ul></>}
    </section>
  );
}

type Repo = { name: string; url: string; description: string | null; language: string | null; updated: string; fork: boolean; stars: number; imported: boolean };
function Accounts({ hub, reload }: { hub: Hub; reload: () => Promise<void> }) {
  const [integrations, setIntegrations] = useState(hub.integrations);
  useEffect(() => { setIntegrations(hub.integrations); }, [hub.integrations]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; tone: "ok" | "err"; text: string } | null>(null);
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const exp = hub.checks.find((c) => c.id === "linkedin_export");
  const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
  const badge = (t: string, tone: "ok" | "muted" | "link") => <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone === "ok" ? "border-brand/50 text-brand-text" : tone === "link" ? "border-border text-foreground" : "border-border text-faint"}`}>{t}</span>;
  const call = async (id: string, body: Rec) => {
    setBusy(id); setNote(null);
    try {
      const r = await fetch("/api/arka/hub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "Could not save.");
      return j;
    } catch (e) { setNote({ id, tone: "err", text: (e as Error).message }); return null; }
    finally { setBusy(null); }
  };
  // Saving a link only stores the URL: no page change, no reload, no scan.
  const saveLink = async (id: string, name: string, url: string) => {
    const j = await call(id, { action: "link", service: id, url });
    if (j) { setIntegrations(j.integrations); setDraft((d) => ({ ...d, [id]: "" })); setNote({ id, tone: "ok", text: url ? `${name} link saved. It is a link only; no account access.` : `${name} link removed.` }); }
  };
  const preview = async () => { const j = await call("github", { action: "github-preview" }); if (j) { setRepos(j.repos); setPick(new Set(j.repos.filter((r: Repo) => !r.fork && !r.imported).map((r: Repo) => r.url))); } };
  const doImport = async () => {
    const j = await call("github", { action: "github-import", repos: (repos || []).filter((r) => pick.has(r.url)) });
    if (j) { setNote({ id: "github", tone: "ok", text: j.added.length ? `Imported ${j.added.length} repositor${j.added.length === 1 ? "y" : "ies"} as projects (source: GitHub public API, ${when(j.at)}). Review them in Employment & projects.` : "Nothing new to import." }); setRepos(null); void reload(); }
  };

  return (
    <div className="space-y-4">
      <ArkaGmailCard />
      <section className={card}>
        <h2 className="text-sm font-bold text-foreground">Profile and portfolio links</h2>
        <p className="text-xs text-muted">Links appear on your resumes and outreach. A saved link is not a connected account: Aarka Tech never signs in to these sites.</p>
        <ul className="mt-2 divide-y divide-border text-sm">
          {integrations.map((i) => (
            <li key={i.id} className="py-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-foreground">{i.name}</span> {badge(i.url ? "Link saved" : "Not added", i.url ? "link" : "muted")}
                  {i.url ? <a className="mt-0.5 block break-all text-xs font-semibold text-brand-text hover:underline" href={i.url} target="_blank" rel="noreferrer">{i.url}</a> : <span className="mt-0.5 block text-xs text-faint">No link saved</span>}
                  <span className="block text-xs text-muted">{i.contributes}{i.saved ? ` · saved ${when(i.saved)}` : ""}</span>
                </div>
                <form className="flex flex-wrap gap-1.5" onSubmit={(e) => { e.preventDefault(); if (draft[i.id]) void saveLink(i.id, i.name, draft[i.id]); }}>
                  <input aria-label={`${i.name} URL`} className="min-h-9 w-60 max-w-full rounded-lg border border-border bg-background/40 px-2 text-xs" placeholder={i.url ? "Replace URL" : "Paste profile URL"} value={draft[i.id] || ""} onChange={(e) => setDraft({ ...draft, [i.id]: e.target.value })} />
                  <button type="submit" className={btn} disabled={!draft[i.id] || busy === i.id}>{busy === i.id ? <Loader2 className="size-3 animate-spin" /> : null} Save</button>
                  {i.url && <button type="button" className={btn} onClick={() => { if (window.confirm(`Remove your ${i.name} link?`)) void saveLink(i.id, i.name, ""); }}>Remove</button>}
                </form>
              </div>
              {i.id === "github" && i.url && (
                <div className="mt-2 rounded-lg border border-border bg-background/40 p-3">
                  <p className="text-xs text-muted">Optional: add your public repositories as projects. This reads the public repository list from GitHub&apos;s API (names, descriptions, languages; no code, no sign-in). You choose which to import.</p>
                  {!repos ? <button type="button" className={`${btn} mt-2`} disabled={busy === "github"} onClick={preview}>{busy === "github" ? <Loader2 className="size-3 animate-spin" /> : null} Import public repositories…</button> : (
                    <div className="mt-2">
                      <ul className="max-h-64 space-y-1 overflow-auto text-xs">{repos.map((r) => (
                        <li key={r.url}><label className={`flex items-start gap-2 ${r.imported ? "opacity-60" : ""}`}>
                          <input type="checkbox" disabled={r.imported} checked={pick.has(r.url)} onChange={(e) => { const n = new Set(pick); if (e.target.checked) n.add(r.url); else n.delete(r.url); setPick(n); }} />
                          <span><span className="font-semibold text-foreground">{r.name}</span>{r.language ? ` · ${r.language}` : ""}{r.fork ? " · fork" : ""}{r.imported ? " · already imported" : ""}{r.description ? ` — ${r.description}` : ""}</span>
                        </label></li>
                      ))}</ul>
                      <div className="mt-2 flex gap-2"><button type="button" className={primary} disabled={!pick.size || busy === "github"} onClick={doImport}>Import {pick.size} selected</button><button type="button" className={btn} onClick={() => setRepos(null)}>Cancel</button></div>
                    </div>
                  )}
                </div>
              )}
              {note?.id === i.id && <p role="status" className={`mt-2 text-xs ${note.tone === "err" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-300"}`}>{note.text}</p>}
            </li>
          ))}
        </ul>
      </section>
      <section className={card}>
        <h2 className="text-sm font-bold text-foreground">Imports</h2>
        <ul className="mt-2 divide-y divide-border text-sm">
          <li className="flex flex-wrap items-start gap-3 py-3">
            <div className="min-w-0 flex-1"><span className="font-semibold text-foreground">LinkedIn data export</span> {badge(exp?.done ? "Imported" : "Not imported", exp?.done ? "ok" : "muted")}
              <span className="block text-xs text-muted">Verified job titles and dates from the export you download from LinkedIn (no sign-in, no scraping).</span></div>
            <a className={btn} href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noreferrer">Request export <ExternalLink className="size-3" /></a>
          </li>
        </ul>
      </section>
    </div>
  );
}
