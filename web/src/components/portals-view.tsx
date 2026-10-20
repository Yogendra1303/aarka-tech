"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Radar, Search, Wrench } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { useJobs, type Job } from "@/components/jobs/job-store";
import { cn } from "@/lib/cn";
import type { WatchedCompany } from "@/lib/portals-config.mjs";

type Company = { name: string; status: string; detail: string };
export type CompanyActivity = { open: number; tracked: { n: string; role: string; status: string; score: string }[] };
type Result = { available: boolean; configured: boolean; companies: Company[]; error?: string };

const TONE: Record<string, { dot: string; label: string; chip: string }> = {
  live: { dot: "bg-emerald-500", label: "live", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  empty: { dot: "bg-amber-500", label: "live · empty", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  broken: { dot: "bg-red-500", label: "broken", chip: "bg-red-500/15 text-red-700 dark:text-red-400" },
  skipped: { dot: "bg-zinc-400", label: "no ATS", chip: "bg-surface-hover text-muted" },
};
const ORDER: Record<string, number> = { broken: 0, empty: 1, live: 2, skipped: 3 };

export function PortalsView({ watched, activity = {} }: { watched: WatchedCompany[]; activity?: Record<string, CompanyActivity> }) {
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const { jobs, startJob } = useJobs();

  // map the agentic "fix-portal" workers to the company they're repairing
  const fixByCompany = useMemo(() => {
    const m = new Map<string, (typeof jobs)[number]>();
    for (const j of jobs) {
      if (j.kind !== "fix-portal" || !j.input) continue;
      const ex = m.get(j.input);
      if (!ex || j.startedAt > ex.startedAt) m.set(j.input, j);
    }
    return m;
  }, [jobs]);

  function check() {
    setLoading(true);
    fetch("/api/portals/verify")
      .then((r) => r.json())
      .then(setRes)
      .catch(() => setRes({ available: false, configured: false, companies: [] }))
      .finally(() => setLoading(false));
  }

  const companies = res?.companies ?? [];
  const broken = companies.filter((c) => c.status === "broken");
  const liveN = companies.filter((c) => c.status === "live" || c.status === "empty").length;
  const sorted = [...companies].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          onClick={check}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 disabled:opacity-50 max-sm:min-h-[44px]"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
          Check portal health
        </button>
        {loading && <span className="text-xs text-faint">Probing each company&apos;s ATS… (~30–60s)</span>}
      </div>

      {!res && watched.length > 0 && <WatchedList watched={watched} activity={activity} />}

      {res && !res.available && !res.error && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted">
          <code className="text-foreground">verify-portals.mjs</code> not found — this needs a complete career-ops
          checkout (the web orchestrates the core&apos;s validator).
        </p>
      )}
      {res && !res.available && res.error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-muted">
          <span className="font-medium text-red-700 dark:text-red-400">The portal check did not finish</span> — no
          portal was verified, so none is shown as healthy. Try again, or run{" "}
          <code className="text-foreground">node verify-portals.mjs</code> to see why.{" "}
          <code className="break-all font-mono text-xs text-faint">{res.error}</code>
        </p>
      )}
      {res && res.available && !res.configured && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted">
          No <code className="text-foreground">portals.yml</code> yet — ask the assistant to set up the companies to scan.
        </p>
      )}

      {res && res.configured && (
        <div className="mt-5">
          <p className="text-sm text-muted">
            <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{liveN}</span> live ·{" "}
            <span className="tabular-nums text-red-600 dark:text-red-400">{broken.length}</span> broken ·{" "}
            <span className="tabular-nums">{companies.length}</span> tracked
          </p>
          {broken.length > 0 && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
              <span className="font-medium text-red-700 dark:text-red-400">
                {broken.length} {broken.length === 1 ? "company silently drops" : "companies silently drop"} from every
                scan
              </span>{" "}
              <span className="text-muted">
                — their careers link is broken. Fix the <code>careers_url</code> in <code>portals.yml</code> (or ask the
                assistant to repair them).
              </span>
            </div>
          )}
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface/40">
            {sorted.map((c) => {
              const t = TONE[c.status] ?? TONE.skipped;
              return (
                <li key={c.name} className="flex items-center gap-3 px-4 py-2.5">
                  <CompanyLogo name={c.name} size={20} />
                  <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} />
                  <span className="shrink-0 text-sm font-medium">{c.name}</span>
                  <span className="truncate font-mono text-xs text-faint">{c.detail}</span>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    {c.status === "broken" && <FixAffordance company={c.name} job={fixByCompany.get(c.name)} onFix={() => startJob({ title: `Fix · ${c.name}`, subtitle: "repair portal slug", kind: "fix-portal", input: c.name, page: "/portals" })} />}
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", t.chip)}>{t.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function FixAffordance({ company, job, onFix }: { company: string; job?: Job; onFix: () => void }) {
  if (job?.status === "running")
    return (
      <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand">
        <Loader2 className="size-3 animate-spin" /> Fixing…
      </Link>
    );
  if (job?.status === "done")
    return (
      <Link href={`/jobs/${job.id}`} className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
        repaired · re-check
      </Link>
    );
  return (
    <button
      onClick={onFix}
      title={`Have the agent repair ${company}'s portal slug`}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-brand/40 hover:text-brand"
    >
      <Wrench className="size-3" /> Fix
    </button>
  );
}

function boardOf(host: string) {
  if (/greenhouse/.test(host)) return "Greenhouse";
  if (/lever/.test(host)) return "Lever";
  if (/ashby/.test(host)) return "Ashby";
  if (/smartrecruiters/.test(host)) return "SmartRecruiters";
  if (/workday|myworkday/.test(host)) return "Workday";
  if (/rippling/.test(host)) return "Rippling";
  return host ? "Careers site" : "—";
}

// Compact source board: a few headline numbers, then one small tile per scanned company with
// what it produced (open postings, tracked applications and their stage). Paused sources fold away.
function WatchedList({ watched, activity }: { watched: WatchedCompany[]; activity: Record<string, CompanyActivity> }) {
  const [q, setQ] = useState("");
  const [showPaused, setShowPaused] = useState(false);
  const scanned = watched.filter((c) => c.enabled);
  const paused = watched.filter((c) => !c.enabled);
  const act = (name: string) => activity[name.trim().toLowerCase()] || { open: 0, tracked: [] };
  const boards = new Map<string, number>();
  for (const c of scanned) boards.set(boardOf(c.host), (boards.get(boardOf(c.host)) || 0) + 1);
  const producing = scanned.filter((c) => act(c.name).open + act(c.name).tracked.length > 0).length;
  const needle = q.trim().toLowerCase();
  const match = (c: WatchedCompany) => !needle || c.name.toLowerCase().includes(needle) || c.host.includes(needle);
  const tiles = scanned.filter(match).sort((a, b) => (act(b.name).tracked.length * 10 + act(b.name).open) - (act(a.name).tracked.length * 10 + act(a.name).open) || a.name.localeCompare(b.name));

  return (
    <div className="mt-5 space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Companies checked", scanned.length, "on every scan"],
          ["Producing roles", producing, "postings or applications"],
          ["Job boards", boards.size, [...boards.keys()].slice(0, 3).join(", ")],
          ["Paused", paused.length, "kept, not scanned"],
        ].map(([label, n, sub]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-surface/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{n}</p>
            <p className="truncate text-[11px] text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-bold text-foreground">Companies checked on every scan</h2>
        <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-surface/40 px-2.5 py-1.5">
          <Search className="size-3.5 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a company…" aria-label="Find a company" className="w-40 bg-transparent text-[13px] outline-none placeholder:text-faint" />
        </div>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((c) => {
          const a = act(c.name);
          return (
            <li key={c.name} className="rounded-xl border border-border bg-surface/50 p-3 transition-colors hover:border-brand/30">
              <div className="flex items-center gap-2">
                <CompanyLogo name={c.name} size={20} />
                <span className="min-w-0 truncate text-sm font-semibold text-foreground">{c.name}</span>
                <span className="ml-auto shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-semibold text-muted">{boardOf(c.host)}</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                <span className="tabular-nums font-semibold text-foreground">{a.open}</span> new posting{a.open === 1 ? "" : "s"} · <span className="tabular-nums font-semibold text-foreground">{a.tracked.length}</span> tracked
              </p>
              {a.tracked.slice(0, 2).map((t) => (
                <Link key={t.n} href={`/pipeline/${encodeURIComponent(t.n)}`} className="mt-1.5 block rounded-md bg-surface-hover/60 px-2 py-1 text-[11px] hover:text-brand">
                  <span className="line-clamp-1 font-medium text-foreground">{t.role}</span>
                  <span className="text-faint">{t.status}{t.score ? ` · ${t.score}` : ""} · open JD and evaluation</span>
                </Link>
              ))}
              {a.open > 0 && <Link href="/pipeline?tab=INBOX" className="mt-1.5 inline-block text-[11px] font-semibold text-brand-text hover:underline">Review postings</Link>}
            </li>
          );
        })}
      </ul>
      {tiles.length === 0 && <p className="text-sm text-faint">No scanned company matches “{q}”.</p>}

      {paused.length > 0 && (
        <div className="rounded-xl border border-border bg-surface/30">
          <button type="button" onClick={() => setShowPaused((v) => !v)} aria-expanded={showPaused} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-muted hover:text-foreground">
            {paused.length} paused sources (not scanned)
            <ChevronDown className={cn("ml-auto size-4 transition-transform", showPaused && "rotate-180")} />
          </button>
          {showPaused && (
            <div className="flex flex-wrap gap-1.5 border-t border-border p-3">
              {paused.filter(match).map((c, i) => <span key={`${i}-${c.name}`} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">{c.name}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
