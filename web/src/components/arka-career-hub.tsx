"use client";

import { ArkaGmailCard } from "@/components/arka-gmail-card";

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
        <Link href="/cv" className={primary}><Upload className="size-4" /> Upload or update resume</Link>
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
          {tab === "checklist" && <Checklist hub={hub} reload={load} setMsg={setMsg} />}
          {tab === "accounts" && <Accounts hub={hub} post={post} />}
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
            <Link href="/cv" className={primary}><Upload className="size-4" /> Upload or replace resume</Link>
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

function Insights({ hub }: { hub: Hub }) {
  const i = hub.insights;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={card}>
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><CheckCircle2 className="size-4 text-brand-text" /> Strongest demonstrated competencies</h2>
        <p className="text-xs text-faint">Evidence-backed: skills linked to two or more sourced achievements.</p>
        <ul className="mt-2 space-y-2 text-sm">{i.strengths.map((s) => <li key={s.name}><span className="font-semibold text-foreground">{s.name}</span> <span className="text-xs text-faint">· {s.how}</span><span className="block text-xs text-muted">e.g. {s.examples[0]}</span></li>)}</ul>
      </section>
      <section className={card}>
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><CheckCircle2 className="size-4 text-brand-text" /> Achievements that set you apart</h2>
        <p className="text-xs text-faint">Evidence-backed: quantified and consistent across your resume versions.</p>
        <ul className="mt-2 space-y-1.5 text-sm text-foreground">{i.differentiators.map((d) => <li key={d.text}>{d.text}<span className="block text-xs text-faint">{d.how}</span></li>)}</ul>
      </section>
      <section className={card}>
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Lightbulb className="size-4 text-amber-600 dark:text-amber-400" /> Gaps seen in jobs you evaluated</h2>
        <p className="text-xs text-faint">From the evaluator&apos;s reports on real postings. Use these to add evidence you have, not to claim skills you lack.</p>
        <ul className="mt-2 space-y-1.5 text-sm">{i.reportGaps.length ? i.reportGaps.map((g, k) => <li key={k} className="text-foreground">{g.gap}<span className="block text-xs text-faint">{g.job}</span></li>) : <li className="text-muted">No evaluated jobs yet.</li>}</ul>
      </section>
      <section className={card}>
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Lightbulb className="size-4 text-amber-600 dark:text-amber-400" /> Recommendations (inferred)</h2>
        <ul className="mt-2 space-y-2 text-sm text-foreground">
          <li>Your target roles: {i.alignedRoles.roles.join(", ")}.<span className="block text-xs text-faint">{i.alignedRoles.how}. Change them in Checklist → preferences or your profile.</span></li>
          {i.toolsWithoutEvidence.length > 0 && <li>Tools listed without supporting achievements: {i.toolsWithoutEvidence.join(", ")}.<span className="block text-xs text-faint">Add a project that shows them, or recruiters may discount them.</span></li>}
          <li>Confirm consulting project dates and outcomes in Experience &amp; projects.<span className="block text-xs text-faint">{hub.projects.filter((p) => p.review_status === "needs_confirmation").length} projects are unconfirmed, so tailored resumes do not use them yet.</span></li>
        </ul>
      </section>
    </div>
  );
}

function Checklist({ hub, reload, setMsg }: { hub: Hub; reload: () => Promise<void>; setMsg: (m: { tone: "ok" | "err"; text: string } | null) => void }) {
  const [form, setForm] = useState(hub.preferences); const [saving, setSaving] = useState(false);
  const order = ["resume", "history", "conflicts", "projects", "achievements", "targets", "locations", "linkedin", "contact", "salary", "notice", "auth", "linkedin_export"];
  const items = [...hub.checks].sort((a, b) => Number(a.done) - Number(b.done) || order.indexOf(a.id) - order.indexOf(b.id));
  const optional = new Set(["salary", "notice", "auth", "linkedin_export", "linkedin"]);
  const save = async () => {
    setSaving(true);
    const r = await fetch("/api/arka/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json(); setSaving(false);
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    setMsg({ tone: "ok", text: j.changed.length ? `Saved: ${j.changed.join(", ").replaceAll("_", " ")} (backup kept).` : "Nothing changed." }); await reload();
  };
  const fld = (k: string, label: string, ph: string) => <label className="block text-xs font-semibold text-muted">{label}<input className={input} value={form[k] || ""} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <section className={card}>
        <h2 className="text-sm font-bold text-foreground">What to do next</h2>
        <ol className="mt-3 space-y-2">{items.map((c) => (
          <li key={c.id} className="flex gap-2 text-sm">
            {c.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-text" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-faint" />}
            <span><span className={`font-semibold ${c.done ? "text-muted" : "text-foreground"}`}>{c.label}</span>{optional.has(c.id) && <span className="ml-1 text-xs text-faint">(optional)</span>}<span className="block text-xs text-muted">{c.detail}</span></span>
          </li>
        ))}</ol>
        {hub.openQuestions.length > 0 && <><h3 className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-faint">Conflicts to confirm</h3><ul className="mt-2 space-y-1 text-xs text-foreground">{hub.openQuestions.map((q) => <li key={q.id}>{q.question || q.issue}</li>)}</ul></>}
      </section>
      <section className={card}>
        <h2 className="text-sm font-bold text-foreground">Optional details</h2>
        <p className="text-xs text-muted">Leave any of these blank; nothing else depends on them. They are never guessed.</p>
        <div className="mt-3 grid gap-3">
          {fld("target_range", "Target salary", "e.g. 45–55 LPA or AED 35,000/month")}{fld("currency", "Currency", "INR or AED")}
          {fld("notice_period_days", "Notice period (days)", "e.g. 30")}{fld("visa_status", "UAE work authorization", "e.g. needs employer visa")}
        </div>
        <button className={`${primary} mt-4`} disabled={saving} onClick={save}>{saving ? <Loader2 className="size-4 animate-spin" /> : null} Save details</button>
      </section>
    </div>
  );
}

function Accounts({ hub, post }: { hub: Hub; post: (b: Rec, ok: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const exp = hub.checks.find((c) => c.id === "linkedin_export");
  const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never");
  const badge = (t: string, tone: "ok" | "muted" | "link") => <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone === "ok" ? "border-brand/50 text-brand-text" : tone === "link" ? "border-border text-foreground" : "border-border text-faint"}`}>{t}</span>;
  return (
    <div className="space-y-4">
      <ArkaGmailCard />
      <section className={card}>
        <h2 className="text-sm font-bold text-foreground">Authorized integrations</h2>
        <p className="text-xs text-muted">Shown as connected only after a real sign-in test succeeds.</p>
        <ul className="mt-2 divide-y divide-border text-sm">
          <li className="flex flex-wrap items-start gap-3 py-3">
            <div className="min-w-0 flex-1"><span className="font-semibold text-foreground">LinkedIn data export</span> {badge(exp?.done ? "Imported" : "Not imported", exp?.done ? "ok" : "muted")}
              <span className="block text-xs text-muted">Contributes: verified job titles and dates. Method: the export you download from LinkedIn (no sign-in, no scraping). Put the files in Documents and they will be reconciled with every change recorded.</span></div>
            <a className={btn} href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noreferrer">Request export <ExternalLink className="size-3" /></a>
          </li>
        </ul>
      </section>
      <section className={card}>
        <h2 className="text-sm font-bold text-foreground">Profile and portfolio links</h2>
        <p className="text-xs text-muted">Saved links appear on resumes and outreach. GitHub can also list your public repositories through GitHub&apos;s public API.</p>
        <ul className="mt-2 divide-y divide-border text-sm">
          {hub.integrations.map((i) => {
            const url = i.url || (i.id === "linkedin" ? (hub.preferences.linkedin ? `https://${hub.preferences.linkedin.replace(/^https?:\/\//, "")}` : null) : null);
            return (
              <li key={i.id} className="py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-foreground">{i.name}</span> {badge(url ? "Link saved" : "Not added", url ? "link" : "muted")}
                    <span className="block text-xs text-muted">Contributes: {i.contributes}.{i.kind === "public-api" ? ` Last sync: ${when(i.lastSync)}${i.repos != null ? ` · ${i.repos} public repositories` : ""}.` : " Link only, no account access."}</span>
                    {url && <a className="block break-all text-xs text-brand-text hover:underline" href={url} target="_blank" rel="noreferrer">{url}</a>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <input aria-label={`${i.name} URL`} className="min-h-9 w-60 max-w-full rounded-lg border border-border bg-background/40 px-2 text-xs" placeholder={url ? "Replace URL" : "Paste profile URL"} value={draft[i.id] || ""} onChange={(e) => setDraft({ ...draft, [i.id]: e.target.value })} />
                    <button className={btn} disabled={!draft[i.id]} onClick={async () => { if (await post({ action: "link", service: i.id, url: draft[i.id] }, `${i.name} link saved.`)) setDraft({ ...draft, [i.id]: "" }); }}>Save</button>
                    {i.kind === "public-api" && i.url && <button className={btn} disabled={busy === i.id} onClick={async () => { setBusy(i.id); await post({ action: "github-refresh" }, "GitHub repositories refreshed."); setBusy(null); }}>{busy === i.id ? <Loader2 className="size-3 animate-spin" /> : null} Refresh</button>}
                    {i.url && <button className={btn} onClick={() => { if (window.confirm(`Remove your ${i.name} link${i.kind === "public-api" ? " and its synced repository list" : ""}?`)) post({ action: "link", service: i.id, url: "" }, `${i.name} link removed.`); }}>Remove</button>}
                  </div>
                </div>
                {i.topRepos.length > 0 && <ul className="mt-2 grid gap-1 pl-3 text-xs text-muted sm:grid-cols-2">{i.topRepos.map((r) => <li key={r.url}><a className="font-semibold text-foreground hover:text-brand-text" href={r.url} target="_blank" rel="noreferrer">{r.name}</a>{r.language ? ` · ${r.language}` : ""}{r.description ? ` — ${r.description}` : ""}</li>)}</ul>}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-faint">The LinkedIn link is also kept in your profile (Checklist). Saving a link never marks an account as connected.</p>
      </section>
    </div>
  );
}
