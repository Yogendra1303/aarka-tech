"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleDashed, CircleSlash, Loader2, Pause, Play, Workflow, XCircle } from "lucide-react";

type Stage = { name: string; status: string; detail: string };
type Auto = {
  paused: boolean; runNowQueued: boolean; nextRunAt: string | null; aiEnabled: boolean;
  lastPipelineRun: { finished: string; failed: number; stages: Stage[] } | null;
  gmail: { connected: boolean; clientConfigured: boolean };
};

// What each automatic step does, in the order the daily run takes them.
const STEPS: { id: string; title: string; what: string }[] = [
  { id: "preflight", title: "Health check", what: "Confirms the tools and sign-ins the run needs." },
  { id: "scan", title: "Find new roles", what: "Checks every active job source for India and UAE roles. Free." },
  { id: "expiry", title: "Close expired postings", what: "Re-checks tracked postings and flags ones that were taken down." },
  { id: "queue", title: "Rank and queue", what: "Orders new roles by fit and queues the best for evaluation." },
  { id: "ai", title: "AI evaluation and tailored resumes", what: "Off until you authorise it with limits. Nothing is charged meanwhile." },
  { id: "verify", title: "Verify generated files", what: "Checks every resume and cover letter before it reaches Documents." },
  { id: "report", title: "Daily report", what: "Writes the summary the Dashboard reads." },
];

const ICON: Record<string, React.ReactNode> = {
  succeeded: <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />,
  partial: <CheckCircle2 className="size-4 text-amber-600 dark:text-amber-400" />,
  failed: <XCircle className="size-4 text-red-600 dark:text-red-400" />,
  skipped: <CircleSlash className="size-4 text-faint" />,
};

export function ArkaAutomationOverview() {
  const [a, setA] = useState<Auto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => fetch("/api/arka/automation", { cache: "no-store" }).then((r) => r.json()).then(setA).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);
  const act = async (action: "pause" | "resume" | "queue-full-run") => {
    setBusy(action); setMsg(null);
    const r = await fetch("/api/arka/automation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    setMsg(r.ok ? (action === "queue-full-run" ? "Full run queued. It starts within 15 minutes." : action === "pause" ? "Automation paused." : "Automation resumed.") : j.error || "Could not update.");
    await load();
  };
  if (!a) return null;
  const stages = new Map((a.lastPipelineRun?.stages || []).map((s) => [s.name, s]));
  const finished = a.lastPipelineRun?.finished ? new Date(a.lastPipelineRun.finished).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 max-sm:p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-foreground"><Workflow className="size-5 text-brand-text" /> Daily automation</h2>
          <p className="mt-0.5 text-sm text-muted">
            {a.paused ? "Paused. Nothing runs on its own until you resume." : `Runs by itself every day${a.nextRunAt ? `; next at ${new Date(a.nextRunAt).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""}.`}
            {finished ? ` Last run finished ${finished}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy || a.paused || a.runNowQueued} onClick={() => act("queue-full-run")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-foreground disabled:opacity-50">
            {busy === "queue-full-run" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} {a.runNowQueued ? "Run queued" : "Run everything now"}
          </button>
          <button type="button" disabled={!!busy} onClick={() => act(a.paused ? "resume" : "pause")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground disabled:opacity-50">
            <Pause className="size-3.5" /> {a.paused ? "Resume" : "Pause all"}
          </button>
        </div>
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-foreground">{msg}</p>}

      <ol className="mt-4 grid gap-2 md:grid-cols-2">
        {STEPS.map((st, i) => {
          const s = stages.get(st.id);
          const status = st.id === "ai" && !a.aiEnabled ? "skipped" : s?.status || "pending";
          return (
            <li key={st.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
              <span className="mt-0.5 shrink-0">{ICON[status] || <CircleDashed className="size-4 text-faint" />}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{i + 1}. {st.title}</p>
                <p className="text-xs text-muted">{st.what}</p>
                {s?.detail && status !== "skipped" && st.id !== "report" && <p className="mt-1 line-clamp-2 text-[11px] text-faint" title={s.detail}>Last run: {s.detail}</p>}
              </div>
            </li>
          );
        })}
        <li className="flex items-start gap-3 rounded-xl border border-border p-3">
          <span className="mt-0.5 shrink-0"><CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" /></span>
          <div className="min-w-0"><p className="text-sm font-semibold text-foreground">Follow-up reminders</p><p className="text-xs text-muted">Works out when each application is due a nudge. <Link href="/followups" className="font-semibold text-brand-text hover:underline">Follow-ups</Link></p></div>
        </li>
        <li className="flex items-start gap-3 rounded-xl border border-border p-3">
          <span className="mt-0.5 shrink-0">{a.gmail.connected ? <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" /> : <CircleDashed className="size-4 text-faint" />}</span>
          <div className="min-w-0"><p className="text-sm font-semibold text-foreground">Gmail drafts</p><p className="text-xs text-muted">{a.gmail.connected ? "Connected. Saves drafts only, never sends." : "Not connected yet."} <Link href="/profile?tab=accounts" className="font-semibold text-brand-text hover:underline">{a.gmail.connected ? "Manage" : "Set up in My Career Hub"}</Link></p></div>
        </li>
      </ol>
      <p className="mt-3 text-xs text-faint">Discovery schedules are below. Applications, emails and recruiter messages are never sent automatically; you approve each one.</p>
    </section>
  );
}
