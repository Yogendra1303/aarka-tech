"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, CalendarClock, Loader2 } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { UsageMeter } from "@/components/usage-meter";

type Auto = {
  paused: boolean; nextRunAt: string | null; runNowQueued: boolean;
  lastScan: { at: string; found: number; added: number } | null;
  queue: { rank: number; evaluate: number; pack: number };
  counts: { tracked: number; evaluated: number; applied: number; interviewing: number; offers: number };
};

const when = (iso: string | null) => {
  if (!iso) return "not scheduled";
  const d = new Date(iso);
  const day = d.toDateString() === new Date().toDateString() ? "Today" : d.toDateString() === new Date(Date.now() + 864e5).toDateString() ? "Tomorrow" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${day}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
};

// Sidebar summary of the search, so the column carries something useful between the nav and the footer.
export function SidebarPulse() {
  const [a, setA] = useState<Auto | null>(null);
  useEffect(() => {
    let live = true;
    const get = () => fetch("/api/arka/automation", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (live) setA(j); }).catch(() => {});
    get(); const t = setInterval(get, 120_000);
    return () => { live = false; clearInterval(t); };
  }, []);
  if (!a?.counts) return null;
  const rows: [string, number, string][] = [
    ["To evaluate", a.queue.evaluate, "/pipeline?tab=INBOX"],
    ["Evaluated", a.counts.evaluated, "/pipeline?tab=EVALUATED"],
    ["Applied", a.counts.applied, "/pipeline?tab=APPLIED"],
    ["Interviewing", a.counts.interviewing, "/pipeline?tab=INTERVIEW"],
  ];
  return (
    <section className="mt-6 rounded-xl border border-border bg-surface/60 p-3" aria-label="Search summary">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint"><Activity className="size-3" /> Your search</p>
      <ul className="mt-2 space-y-0.5">
        {rows.map(([l, n, href]) => (
          <li key={l}><Link href={href} className="flex items-center justify-between rounded-md px-1.5 py-1 text-xs text-muted hover:bg-surface-hover hover:text-foreground">{l}<span className="font-bold tabular-nums text-foreground">{n}</span></Link></li>
        ))}
      </ul>
      <Link href="/scheduled-scans" className="mt-2 block rounded-md border border-border px-2 py-1.5 text-[11px] text-muted hover:text-foreground">
        <span className="flex items-center gap-1.5 font-semibold text-foreground"><CalendarClock className="size-3" /> {a.paused ? "Automation paused" : a.runNowQueued ? "Run queued" : "Next scan"}</span>
        {!a.paused && !a.runNowQueued && <span className="block">{when(a.nextRunAt)}</span>}
        {a.lastScan && <span className="block text-faint">Last: {a.lastScan.found.toLocaleString("en-IN")} checked, {a.lastScan.added} new</span>}
      </Link>
    </section>
  );
}

// Token usage appears only while something is working (a resume being built, an evaluation…) and hides after.
export function SidebarUsage() {
  const { jobs } = useJobs();
  const running = jobs.filter((j) => j.status === "running");
  if (!running.length) return null;
  return (
    <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-2">
      <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-brand-text"><Loader2 className="size-3 animate-spin" /> Working: {running[0].title}{running.length > 1 ? ` +${running.length - 1}` : ""}</p>
      <UsageMeter />
    </div>
  );
}
