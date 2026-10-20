"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, CalendarClock, Mail, CirclePause, CirclePlay, ListChecks, Loader2, Play, Radar, TriangleAlert, Workflow } from "lucide-react";
import type { AutomationStatus } from "@/lib/arka/automation";

// Aarka Tech command center: real metrics, Run Now and the local automation
// panel. Every value comes from /api/arka/automation (files the local pipeline
// writes); every button calls a real route and reports the route's own result.

const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};
const ago = (iso: string | null | undefined) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

type Feedback = { tone: "ok" | "err" | "info"; text: string } | null;

export function ArkaCommandCenter({ newThisWeek, followupsDue, awaiting, packHref = "/pipeline" }: { newThisWeek: number | null; followupsDue: number | null; awaiting: number; packHref?: string }) {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"scan" | "full" | "pause" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [profile, setProfile] = useState<{ completion: number; checks: { id: string; label: string; done: boolean }[] } | null>(null);
  type Overview = { awaitingEvaluation: number; shortlisted: number; toDecide: number; inProgress: number; interviews: number; staleApplied: { n: string; company: string; role: string; date: string }[]; strongest: { n: string; company: string; role: string; score: string; status: string; verdict: string; strength: string }[]; favourites: number; favouriteRoles: { company: string; role: string; url: string }[] };
  const [ov, setOv] = useState<Overview | null>(null);
  useEffect(() => { fetch("/api/arka/overview", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setOv(j)).catch(() => {}); }, []);
  const mounted = useRef(true);
  useEffect(() => { fetch("/api/arka/profile").then((r) => (r.ok ? r.json() : null)).then((j) => j && setProfile(j)).catch(() => {}); }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/arka/automation", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      if (mounted.current) { setStatus(j); setLoadError(null); }
    } catch (e) {
      if (mounted.current) setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const t = setInterval(load, 30_000);
    return () => { mounted.current = false; clearInterval(t); };
  }, [load]);

  const schedule = status?.schedules.find((s) => s.active) || status?.schedules[0];

  const runDiscovery = async () => {
    if (!schedule || busy) return;
    setBusy("scan");
    setFeedback({ tone: "info", text: "Scanning your job sources… this usually takes under a minute." });
    try {
      const r = await fetch(`/api/scheduled-jobs/${schedule.id}/run`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === false) throw new Error(j.error || j.summary?.message || `HTTP ${r.status}`);
      setFeedback({ tone: "ok", text: `${j.summary?.message || "Scan finished."} The pipeline updates the tracker within 15 minutes.` });
    } catch (e) {
      setFeedback({ tone: "err", text: `Scan failed: ${(e as Error).message}` });
    } finally {
      setBusy(null);
      load();
    }
  };

  const post = async (action: "pause" | "resume" | "queue-full-run", kind: "full" | "pause") => {
    if (busy) return;
    setBusy(kind);
    try {
      const r = await fetch("/api/arka/automation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setStatus(j);
      setFeedback({
        tone: "ok",
        text: action === "queue-full-run" ? "Full pipeline queued. The local worker starts it within 15 minutes." : action === "pause" ? "Automation paused. No new scheduled work will start." : "Automation resumed.",
      });
    } catch (e) {
      setFeedback({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const failed = status?.lastPipelineRun?.failed ?? 0;
  const pendingAi = status?.queue ? status.queue.rank + status.queue.evaluate + status.queue.pack : null;
  const n = (v: number | null | undefined) => (v == null ? "—" : String(v));
  const tiles: { label: string; value: string; hint: string; href?: string; warn?: boolean }[] = [
    { label: "Awaiting evaluation", value: n(ov?.awaitingEvaluation), hint: "New postings to review", href: "/pipeline?tab=INBOX" },
    { label: "Shortlisted", value: n(ov?.shortlisted), hint: `Fit 4+ not applied yet (${n(ov?.toDecide)} to decide)`, href: "/pipeline?focus=decide&fit=4" },
    { label: "In progress", value: n(ov?.inProgress), hint: "Applied, responded or assessment", href: "/pipeline?focus=applied" },
    { label: "Interviews & replies", value: n(ov?.interviews), hint: "Interviewing or recruiter replied", href: "/pipeline?focus=interview" },
    { label: "Follow-ups due", value: n(followupsDue), hint: "Overdue or due today", href: "/followups" },
    { label: "Failed or blocked", value: status ? String(failed) : "—", hint: failed ? "Last automatic run" : "Last run had no failures", href: "/scheduled-scans", warn: failed > 0 },
  ];
  void pendingAi; void newThisWeek;


  return (
    <section aria-label="Command center" className="mt-6 space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => {
          const body = (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t.label}</div>
              <div className={`mt-1 text-2xl font-extrabold tabular-nums tracking-tight ${t.warn ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{t.value}</div>
              <div className="mt-0.5 text-xs text-muted">{t.hint}</div>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="rounded-xl border border-border bg-surface p-3 transition hover:border-brand/50">{body}</Link>
          ) : (
            <div key={t.label} className="rounded-xl border border-border bg-surface p-3">{body}</div>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-3">
      {(() => {
        const acts: { text: string; href: string }[] = [];
        if (status?.paused) acts.push({ text: "Automation is paused: resume it so the scheduled scan runs", href: "#automation" });
        if (failed) acts.push({ text: `Check the ${failed} failed pipeline stage(s) from the last run`, href: "#automation" });
        if (awaiting > 0) acts.push({ text: `Review ${awaiting} evaluated role(s) and decide whether to apply`, href: packHref });
        if (followupsDue) acts.push({ text: `Send ${followupsDue} follow-up(s) that are due`, href: "/followups" });
        const missing = profile?.checks.filter((c) => !c.done && ["salary", "notice", "auth", "conflicts"].includes(c.id)) || [];
        if (missing.length) acts.push({ text: `Complete your profile: ${missing.map((c) => c.label.toLowerCase()).join(", ")}`, href: "/profile?tab=checklist" });
        if ((newThisWeek || 0) > 0) acts.push({ text: `Look through ${newThisWeek} new role(s) found this week`, href: "/explore?view=fresh" });
        return acts.length ? (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-faint">Next best actions</h2>
            <ol className="mt-2 divide-y divide-border">{acts.slice(0, 5).map((a, i) => (
              <li key={i}><Link href={a.href} className="group flex items-center gap-3 py-2 text-sm text-foreground hover:text-brand-text">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-text">{i + 1}</span>
                <span className="min-w-0 flex-1">{a.text}</span><span aria-hidden="true" className="text-faint transition group-hover:translate-x-0.5 group-hover:text-brand-text">→</span>
              </Link></li>
            ))}</ol>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted"><h2 className="text-xs font-bold uppercase tracking-[0.12em] text-faint">Next best actions</h2><p className="mt-2">Nothing needs you right now.</p></div>
        );
      })()}
      {/* Primary actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runDiscovery}
          disabled={!schedule || !!busy || status?.paused}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "scan" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {busy === "scan" ? "Running…" : "Run discovery now"}
        </button>
        <button type="button" onClick={() => post("queue-full-run", "full")} disabled={!!busy || status?.paused || status?.runNowQueued}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-50">
          <Workflow className="size-4 text-brand-text" /> {status?.runNowQueued ? "Full run queued" : "Run full pipeline"}
        </button>
        <Link href="/explore?view=fresh" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:border-brand/50">
          <Radar className="size-4 text-brand-text" /> Review matches
        </Link>
        <Link href={packHref} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:border-brand/50">
          <Workflow className="size-4 text-brand-text" /> Prepare application pack
        </Link>
        <Link href="/pipeline" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:border-brand/50">
          <ListChecks className="size-4 text-brand-text" /> Open applications
        </Link>
      </div>
      {feedback && (
        <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${feedback.tone === "err" ? "border-red-500/40 text-red-600 dark:text-red-400" : feedback.tone === "ok" ? "border-brand/40 text-foreground" : "border-border text-muted"}`}>
          {feedback.text}
        </p>
      )}

        </div>
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-faint">Strongest opportunities</h2>
          {!ov ? <p className="mt-2 text-sm text-muted">Loading…</p> : ov.strongest.length === 0 ? <p className="mt-2 text-sm text-muted">No evaluated roles yet. Evaluate a job from Explore to see your fit.</p> : (
            <ul className="mt-2 divide-y divide-border">
              {ov.strongest.map((o) => (
                <li key={o.n}><Link href={`/pipeline/${o.n}`} className="flex items-start gap-3 py-2 hover:text-brand-text">
                  <span className="mt-0.5 rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-extrabold tabular-nums text-brand-text">{o.score.replace("/5", "")}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{o.company} · {o.role}</span>
                    <span className="block truncate text-xs text-muted">{o.status.charAt(0) + o.status.slice(1).toLowerCase()}{o.verdict ? ` · verdict ${o.verdict}` : ""}{o.strength ? ` · ${o.strength}` : ""}</span></span>
                </Link></li>
              ))}
            </ul>
          )}
        </div>
        {ov && (ov.staleApplied.length > 0 || ov.favouriteRoles.length > 0) && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-faint">Needs attention</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {ov.staleApplied.map((a) => <li key={a.n}><Link href="/followups" className="text-foreground hover:text-brand-text">No reply from {a.company} since {a.date}: consider a follow-up →</Link></li>)}
              {ov.favouriteRoles.map((r) => <li key={r.url}><Link href="/pipeline?tab=INBOX" className="text-foreground hover:text-brand-text">★ New at {r.company}: {r.role} →</Link></li>)}
            </ul>
          </div>
        )}
      </div>
      </div>

      {/* Automation + activity */}
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div id="automation" className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><CalendarClock className="size-4 text-brand-text" /> Automation</h2>
            <button type="button" onClick={() => post(status?.paused ? "resume" : "pause", "pause")} disabled={!status || !!busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition hover:border-brand/50 disabled:opacity-50">
              {status?.paused ? <><CirclePlay className="size-3.5" /> Resume</> : <><CirclePause className="size-3.5" /> Pause</>}
            </button>
          </div>
          {loadError ? (
            <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"><TriangleAlert className="size-4" /> {loadError}</p>
          ) : !status ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-faint">State</dt>
              <dd className={status.paused ? "font-semibold text-amber-600 dark:text-amber-400" : "font-semibold text-foreground"}>{status.paused ? "Paused" : status.runNowQueued ? "Full run queued" : "Active"}</dd>
              <dt className="text-faint">Scheduler</dt>
              <dd className="text-foreground">{status.scheduler.installed ? `Installed · checked ${ago(status.scheduler.lastCheckAt)}` : "Not installed"}</dd>
              <dt className="text-faint">Schedule</dt>
              <dd className="text-foreground">{schedule ? <Link href="/scheduled-scans" className="hover:text-brand-text">{schedule.name} · {schedule.cadence}</Link> : <Link href="/scheduled-scans" className="text-brand-text">Create a schedule</Link>}</dd>
              <dt className="text-faint">Next run</dt>
              <dd className="text-foreground">{fmt(status.nextRunAt)}</dd>
              <dt className="text-faint">Last scan</dt>
              <dd className="text-foreground">{status.lastScan ? `${ago(status.lastScan.at)} · ${status.lastScan.added} new of ${status.lastScan.found.toLocaleString()} checked` : "No scans yet"}</dd>
              <dt className="text-faint">Last pipeline</dt>
              <dd className={failed ? "text-red-600 dark:text-red-400" : "text-foreground"}>{status.lastPipelineRun ? `${ago(status.lastPipelineRun.finished)} · ${failed ? `${failed} stage(s) failed` : "all stages OK"}` : "Not run yet"}</dd>
              <dt className="text-faint">AI stage</dt>
              <dd className="text-foreground">{status.aiEnabled ? "On, within limits" : "Scheduled AI off until you authorize it"}{status.aiProvidersReady != null ? ` · ${status.aiProvidersReady} AI provider${status.aiProvidersReady === 1 ? "" : "s"} enabled` : ""}</dd>
              <dt className="text-faint">Gmail</dt>
              <dd className="text-foreground"><Link href="/profile?tab=accounts" className="inline-flex items-center gap-1 hover:text-brand-text"><Mail className="size-3.5" />{status.gmail.connected ? "Connected (drafts only)" : status.gmail.clientConfigured ? "Ready to connect" : "Not set up"}</Link></dd>
            </dl>
          )}
          <p className="mt-3 text-xs text-faint">Runs on this Mac while it is on. If it is asleep at the scheduled time, the run starts after it wakes. Nothing runs while it is shut down.</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><Activity className="size-4 text-brand-text" /> Recent activity</h2>
          {!status ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : status.activity.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet. New matching roles, documents, status changes and follow-ups will appear here.</p>
          ) : (
            <ul className="space-y-2">
              {status.activity.map((a, i) => (
                <li key={`${a.at}-${i}`}>
                  <Link href={a.href || "#"} className="flex items-start gap-2.5 rounded-md text-sm hover:text-brand-text">
                    <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${a.ok ? "bg-brand" : "bg-red-500"}`} />
                    <span className={`min-w-0 flex-1 ${a.ok ? "text-foreground" : "text-red-600 dark:text-red-400"}`}>{a.text}</span>
                    <span className="shrink-0 text-xs tabular-nums text-faint">{ago(a.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
