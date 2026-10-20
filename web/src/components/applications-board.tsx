"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Ban, Check, ExternalLink, FileText, Inbox, LayoutGrid, List, MapPin, Search, ShieldCheck } from "lucide-react";
import type { Application } from "@/lib/career-ops";
import type { Evaluation } from "@/lib/arka/evaluations";
import { CompanyLogo } from "@/components/company-logo";
import { StatusSelect } from "@/components/status-select";
import { canonStatus, scoreNum } from "@/lib/format";
import { saveStatuses } from "@/lib/pipeline-status.mjs";
import { postingHref } from "@/lib/posting-url.mjs";
import { cityName, companyName } from "@/lib/arka/normalize.mjs";
import { cn } from "@/lib/cn";

// Board columns, in the order a role moves through them.
const COLUMNS: { id: string; title: string; hint: string; states: string[] }[] = [
  { id: "decide", title: "To decide", hint: "Evaluated, not applied yet", states: ["EVALUATED"] },
  { id: "applied", title: "Applied", hint: "Waiting to hear back", states: ["APPLIED"] },
  { id: "process", title: "In process", hint: "Responded or assessment", states: ["RESPONDED", "ASSESSMENT"] },
  { id: "interview", title: "Interviewing", hint: "", states: ["INTERVIEW"] },
  { id: "offer", title: "Offer", hint: "", states: ["OFFER", "HIRED"] },
];
const CLOSED = ["REJECTED", "DISCARDED", "SKIP"];
const stateOf = (a: Application) => canonStatus(a.status).toUpperCase();

function ScoreRing({ score }: { score: string }) {
  const n = scoreNum(score);
  if (Number.isNaN(n)) return <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border text-xs text-faint">—</span>;
  const pct = Math.max(0, Math.min(1, n / 5));
  const color = n >= 4.2 ? "#16a34a" : n >= 3.8 ? "#EC5E27" : n >= 3 ? "#a16207" : "#dc2626";
  return (
    <span className="relative grid size-11 shrink-0 place-items-center" title={`Fit score ${score}`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="3" /><circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${pct * 97.4} 97.4`} /></svg>
      <span className="text-[13px] font-extrabold tabular-nums text-foreground">{n.toFixed(1)}</span>
    </span>
  );
}

function decisionTone(d: string) {
  const k = d.toLowerCase();
  if (/apply|pursue|go/.test(k)) return "bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300";
  if (/consider|maybe|stretch|hold/.test(k)) return "bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300";
  if (/skip|pass|no/.test(k)) return "bg-red-500/10 text-red-700 ring-red-500/30 dark:text-red-300";
  return "bg-surface-hover text-muted ring-border";
}

function RoleCard({ a, ev, onChanged }: { a: Application; ev: Evaluation | null; onChanged: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  const posting = postingHref(a.url);
  const city = a.location ? cityName(a.location) : ev?.location ? cityName(ev.location) : "";
  const closed = CLOSED.includes(stateOf(a));
  const notRelevant = async () => {
    setBusy(true);
    const { failed } = await saveStatuses([a], "SKIP");
    setBusy(false);
    onChanged(failed.length ? `Could not update ${a.company}: ${failed[0].error}` : `${companyName(a.company)} · ${a.role} marked not relevant.`);
  };
  return (
    <article className={cn("rounded-xl border border-border bg-surface p-3.5 shadow-sm transition hover:border-brand/40 hover:shadow-md", closed && "opacity-70")}>
      <div className="flex items-start gap-3">
        <CompanyLogo name={companyName(a.company)} size={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-muted">{companyName(a.company)}</p>
          <Link href={`/pipeline/${encodeURIComponent(a.n)}`} className="line-clamp-2 text-sm font-bold leading-snug text-foreground hover:text-brand-text">{a.role}</Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-faint">
            {city && <span className="inline-flex items-center gap-0.5"><MapPin className="size-3" />{city}</span>}
            {ev?.archetype && <span>{ev.archetype}</span>}
            <span>#{a.n} · {a.date}</span>
          </p>
        </div>
        <ScoreRing score={a.score} />
      </div>

      {ev && (ev.decision || ev.legitimacy) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {ev.decision && <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-bold ring-1", decisionTone(ev.decision))}>Verdict: {ev.decision}</span>}
          {ev.legitimacy && <span className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-1.5 py-0.5 text-[11px] text-muted"><ShieldCheck className="size-3" />{ev.legitimacy}</span>}
          {ev.risk && <span className="rounded-md bg-surface-hover px-1.5 py-0.5 text-[11px] text-muted">Risk {ev.risk.toLowerCase()}</span>}
        </div>
      )}
      {ev && (ev.strengths.length > 0 || ev.gaps.length > 0 || ev.hardStops.length > 0) && (
        <ul className="mt-2.5 space-y-1 text-[12px] leading-snug">
          {ev.hardStops.slice(0, 1).map((t) => <li key={t} className="flex gap-1.5 text-red-700 dark:text-red-300"><Ban className="mt-0.5 size-3 shrink-0" />{t}</li>)}
          {ev.strengths.slice(0, 2).map((t) => <li key={t} className="flex gap-1.5 text-foreground"><Check className="mt-0.5 size-3 shrink-0 text-emerald-600" /><span className="line-clamp-2">{t}</span></li>)}
          {ev.gaps.slice(0, 1).map((t) => <li key={t} className="flex gap-1.5 text-muted"><AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-600" /><span className="line-clamp-2">{t}</span></li>)}
        </ul>
      )}
      {!ev && <p className="mt-2.5 text-[12px] text-faint">No evaluation report yet.</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        <StatusSelect n={a.n} current={a.status} inline applicationLabel={`${a.company}, ${a.role} (#${a.n})`} onSaved={(s) => onChanged(`${companyName(a.company)} moved to ${s}.`)} />
        <span className="ml-auto flex items-center gap-1">
          <Link href={`/pipeline/${encodeURIComponent(a.n)}`} title="Open the full evaluation" className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold text-foreground hover:border-brand/40 hover:text-brand-text"><FileText className="size-3" /> Evaluation</Link>
          {posting && <a href={posting} target="_blank" rel="noreferrer" title="Open the job post" aria-label={`Open the job post for ${a.role}`} className="inline-flex h-7 items-center rounded-md border border-border px-1.5 text-muted hover:text-foreground"><ExternalLink className="size-3" /></a>}
          {!closed && <button type="button" disabled={busy} onClick={notRelevant} title="Not relevant" aria-label={`Mark ${a.role} at ${a.company} not relevant`} className="inline-flex h-7 items-center rounded-md border border-border px-1.5 text-muted hover:text-red-600 disabled:opacity-50"><Ban className="size-3" /></button>}
        </span>
      </div>
    </article>
  );
}

export function ApplicationsBoard({ applications, evaluations, inboxCount }: { applications: Application[]; evaluations: Record<string, Evaluation | null>; inboxCount: number }) {
  const router = useRouter();
  const sp = useSearchParams();
  // Deep links from the Dashboard: ?focus=<column id> narrows to that stage, ?fit=4 sets a minimum fit.
  const focus = sp.get("focus") || "";
  const [q, setQ] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [minScore, setMinScore] = useState(sp.get("fit") || "");
  const [showClosed, setShowClosed] = useState(false);
  const [note, setNote] = useState("");
  const refresh = (msg: string) => { setNote(msg); startTransition(() => router.refresh()); };

  const cityFor = (a: Application) => (a.location ? cityName(a.location) : evaluations[a.n]?.location ? cityName(evaluations[a.n]!.location) : "");
  const companies = useMemo(() => [...new Set(applications.map((a) => companyName(a.company)))].sort(), [applications]);
  const cities = useMemo(() => [...new Set(applications.map(cityFor).filter(Boolean))].sort(), [applications]); // eslint-disable-line react-hooks/exhaustive-deps
  const types = useMemo(() => [...new Set(applications.map((a) => evaluations[a.n]?.archetype || "").filter(Boolean))].sort(), [applications, evaluations]);

  const rows = applications.filter((a) => {
    if (company && companyName(a.company) !== company) return false;
    if (city && cityFor(a) !== city) return false;
    if (type && evaluations[a.n]?.archetype !== type) return false;
    if (minScore && !(scoreNum(a.score) >= Number(minScore))) return false;
    if (q.trim()) { const n = q.toLowerCase(); if (!`${a.company} ${a.role} ${a.notes || ""}`.toLowerCase().includes(n)) return false; }
    return true;
  });
  const sortByScore = (list: Application[]) => [...list].sort((x, y) => (scoreNum(y.score) || 0) - (scoreNum(x.score) || 0));
  const closed = rows.filter((a) => CLOSED.includes(stateOf(a)));
  const active = rows.length - closed.length;
  const avg = (() => { const s = applications.map((a) => scoreNum(a.score)).filter((n) => !Number.isNaN(n)); return s.length ? (s.reduce((x, y) => x + y, 0) / s.length).toFixed(1) : "—"; })();
  const sel = "min-h-9 rounded-lg border border-border bg-surface px-2 text-sm text-foreground";

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 max-sm:px-4 max-sm:pb-24">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-foreground">Applications</h1>
          <p className="mt-1 text-sm text-muted">Every role you are pursuing, with Aarka&apos;s evaluation of how you fit that company.</p>
        </div>
        <Link href="/pipeline?tab=INBOX" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground">
          <Inbox className="size-4" /> Review {inboxCount} new posting{inboxCount === 1 ? "" : "s"} <ArrowRight className="size-4" />
        </Link>
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="View">
          <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-brand-soft px-3 text-xs font-semibold text-brand-text"><LayoutGrid className="size-3.5" /> Board</span>
          <Link href="/pipeline?tab=ALL" className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-muted hover:text-foreground"><List className="size-3.5" /> Table</Link>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Active roles", String(applications.filter((a) => !CLOSED.includes(stateOf(a))).length)],
          ["To decide", String(applications.filter((a) => stateOf(a) === "EVALUATED").length)],
          ["Applied", String(applications.filter((a) => ["APPLIED", "RESPONDED", "ASSESSMENT", "INTERVIEW", "OFFER", "HIRED"].includes(stateOf(a))).length)],
          ["Interviews", String(applications.filter((a) => stateOf(a) === "INTERVIEW").length)],
          ["Average fit", avg === "—" ? avg : `${avg} / 5`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{l}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/60 p-2">
        <span className="flex min-h-9 flex-1 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 sm:max-w-xs">
          <Search className="size-3.5 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, role or notes" aria-label="Search applications" className="w-full bg-transparent text-sm outline-none placeholder:text-faint" />
        </span>
        <select aria-label="Company" value={company} onChange={(e) => setCompany(e.target.value)} className={sel}><option value="">All companies</option>{companies.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Role type" value={type} onChange={(e) => setType(e.target.value)} className={sel}><option value="">All role types</option>{types.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} className={sel}><option value="">All cities</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Minimum fit" value={minScore} onChange={(e) => setMinScore(e.target.value)} className={sel}><option value="">Any fit</option>{["4.5", "4", "3.5", "3"].map((m) => <option key={m} value={m}>Fit {m}+</option>)}</select>
        <label className="ml-auto inline-flex items-center gap-2 px-2 text-xs text-muted"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show closed ({closed.length})</label>
      </div>
      <p role="status" className="mt-2 flex min-h-5 flex-wrap items-center gap-2 text-xs text-muted">{note || `${active} active role${active === 1 ? "" : "s"} shown`}
        {(focus || sp.get("fit")) && <Link href="/pipeline" className="font-semibold text-brand-text hover:underline">Show the whole board</Link>}
      </p>

      <div className="mt-1 flex gap-3 overflow-x-auto pb-3">
        {COLUMNS.filter((col) => !focus || col.id === focus || (focus === "interview" && col.id === "process")).map((col) => {
          const list = sortByScore(rows.filter((a) => col.states.includes(stateOf(a))));
          return (
            <section key={col.id} aria-label={col.title} className={cn("shrink-0 rounded-2xl border border-border bg-surface-hover/30 p-2.5", list.length ? "w-[19.5rem]" : "w-[12.5rem]")}>
              <header className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-bold text-foreground">{col.title}</h2>
                <span className="rounded-full bg-surface px-2 text-xs font-bold tabular-nums text-muted">{list.length}</span>
              </header>
              {col.hint && <p className="-mt-1 mb-2 px-1 text-[11px] text-faint">{col.hint}</p>}
              <div className="space-y-2.5">
                {list.map((a) => <RoleCard key={a.n} a={a} ev={evaluations[a.n] ?? null} onChanged={refresh} />)}
                {list.length === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-faint">Nothing here yet</p>}
              </div>
            </section>
          );
        })}
      </div>

      {showClosed && closed.length > 0 && (
        <section className="mt-4" aria-label="Closed">
          <h2 className="mb-2 text-sm font-bold text-foreground">Closed · not relevant, rejected or withdrawn</h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">{sortByScore(closed).map((a) => <RoleCard key={a.n} a={a} ev={evaluations[a.n] ?? null} onChanged={refresh} />)}</div>
        </section>
      )}
    </div>
  );
}
