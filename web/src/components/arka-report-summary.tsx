import { AlertTriangle, Ban, CheckCircle2, ChevronDown, CircleDashed, ExternalLink, HelpCircle, Info, MinusCircle } from "lucide-react";
import type { Coverage, ReportModel, Requirement } from "@/lib/arka/report-model";
import { cn } from "@/lib/cn";

const APPLY_LINE = 4.0;
const GROUPS: { id: Coverage; title: string; hint: string; icon: React.ReactNode; tone: string }[] = [
  { id: "blocker", title: "Potential blockers", hint: "Critical, or flagged by the evaluation as a likely screen-out.", icon: <Ban className="size-4" />, tone: "text-red-700 dark:text-red-300" },
  { id: "missing", title: "No evidence in your profile", hint: "Not found in your resume or profile. If you have it, add it; absence of evidence is not the same as not having it.", icon: <MinusCircle className="size-4" />, tone: "text-amber-700 dark:text-amber-300" },
  { id: "partial", title: "Partial match", hint: "Related experience, but not a direct match.", icon: <CircleDashed className="size-4" />, tone: "text-amber-700 dark:text-amber-300" },
  { id: "strong", title: "Strong match", hint: "Directly supported by your resume.", icon: <CheckCircle2 className="size-4" />, tone: "text-emerald-700 dark:text-emerald-300" },
];

export function verdictOf(m: ReportModel): { label: string; tone: string } {
  if (m.state === "failed") return { label: "Evaluation incomplete", tone: "border-border bg-surface-hover text-muted" };
  const d = m.decision.toLowerCase();
  if (/skip|pass|no/.test(d)) return { label: "Skip", tone: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" };
  if (/apply/.test(d) && (m.score ?? 0) >= 4.2) return { label: "Strong match", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  if (/apply/.test(d)) return { label: "Apply", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  return { label: "Consider", tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" };
}

function sourceOf(url: string) {
  try { const h = new URL(url).host.replace(/^www\./, ""); return /greenhouse/.test(h) ? "Greenhouse" : /lever/.test(h) ? "Lever" : /ashby/.test(h) ? "Ashby" : /smartrecruiters/.test(h) ? "SmartRecruiters" : /workday/.test(h) ? "Workday" : h; } catch { return ""; }
}

// The top of the report: what was decided, why, and what to do.
export function ReportDecisionHeader({ m, company, role, actions }: { m: ReportModel; company: React.ReactNode; role?: string; actions: React.ReactNode }) {
  const v = verdictOf(m);
  const pass = m.score != null && m.score >= APPLY_LINE;
  const reasons = m.state === "failed" ? [] : (v.label === "Skip" || v.label === "Consider" ? [...m.hardStops, ...m.softGaps] : m.strengths).slice(0, 2);
  const meta = [m.location, m.url ? sourceOf(m.url) : "", m.date, m.archetype].filter(Boolean);
  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-5 max-sm:p-4" aria-label="Decision">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          {company}
          {role && <p className="mt-1 text-base font-semibold text-foreground">{role}</p>}
          {meta.length > 0 && <p className="mt-1 text-xs text-muted">{meta.join(" · ")}</p>}
        </div>
        {m.state !== "failed" && (
          <div className="shrink-0 text-right">
            <p className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground">{m.score?.toFixed(1)}<span className="text-lg text-faint">/5</span></p>
            <p className={cn("mt-0.5 text-xs font-semibold", pass ? "text-emerald-700 dark:text-emerald-300" : "text-muted")}>{pass ? "Above" : "Below"} the {APPLY_LINE.toFixed(1)} apply line</p>
            {m.confidence && <p className="mt-0.5 text-xs text-muted" title={m.confidenceWhy || undefined}>Confidence: {m.confidence}{m.confidenceWhy ? " ⓘ" : ""}</p>}
          </div>
        )}
      </div>

      {m.state === "failed" ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200"><AlertTriangle className="size-4" /> This evaluation did not finish, so there is no verdict.</p>
          <ul className="mt-1 list-disc pl-6 text-xs text-muted">{m.problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-lg border px-2.5 py-1 text-sm font-bold", v.tone)}>{v.label}</span>
            {m.legitimacy && <span className="rounded-lg bg-surface-hover px-2 py-1 text-xs text-muted">Posting: {m.legitimacy}</span>}
            {m.state === "partial" && <span className="rounded-lg border border-amber-500/30 px-2 py-1 text-xs text-amber-700 dark:text-amber-300" title={m.problems.join(" ")}>Partly complete</span>}
          </div>
          {m.verdictLine && <p className="mt-2 text-[15px] leading-relaxed text-foreground">{m.verdictLine}</p>}
          {reasons.length > 0 && !m.verdictLine && (
            <ul className="mt-2 space-y-1 text-sm text-foreground">{reasons.map((r) => <li key={r}>• {r}</li>)}</ul>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {actions}
        {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:border-brand/40 max-sm:min-h-[44px]">Open original posting <ExternalLink className="size-3.5" /></a>}
      </div>
    </section>
  );
}

function Evidence({ r }: { r: Requirement }) {
  const long = r.evidence.length > 140;
  if (!r.evidence) return <span className="text-faint">—</span>;
  return long ? (
    <details className="group">
      <summary className="cursor-pointer list-none text-muted"><span className="line-clamp-2">{r.evidence}</span><span className="text-xs font-semibold text-brand-text group-open:hidden">Show more</span></summary>
      <p className="mt-1 text-muted">{r.evidence}</p>
    </details>
  ) : <span className="text-muted">{r.evidence}</span>;
}

export function ReportFitSummary({ m }: { m: ReportModel }) {
  if (m.state === "failed") return null;
  const col = (title: string, items: string[], icon: React.ReactNode, empty: string) => (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-faint">{icon}{title}</h3>
      {items.length ? <ul className="mt-2 space-y-1.5 text-sm text-foreground">{items.slice(0, 4).map((x) => <li key={x} className="leading-snug">{x}</li>)}</ul> : <p className="mt-2 text-sm text-faint">{empty}</p>}
    </div>
  );
  return (
    <section className="mt-4 grid gap-3 md:grid-cols-3" aria-label="Fit summary">
      {col("Where you match", m.strengths, <CheckCircle2 className="size-3.5 text-emerald-600" />, "None recorded.")}
      {col("Gaps", [...m.hardStops, ...m.softGaps], <AlertTriangle className="size-3.5 text-amber-600" />, "No gaps recorded.")}
      {col("Still unknown", m.openQuestions, <HelpCircle className="size-3.5 text-muted" />, "Nothing open.")}
    </section>
  );
}

export function ReportCoverage({ m }: { m: ReportModel }) {
  if (!m.requirements.length) return null;
  return (
    <section className="mt-6" aria-label="Requirement coverage">
      <h2 className="text-lg font-extrabold tracking-tight text-foreground">Requirement coverage</h2>
      <p className="mt-0.5 text-sm text-muted">{m.requirements.length} requirements from the job description, checked against your resume and profile.</p>
      <div className="mt-3 space-y-3">
        {GROUPS.map((g) => {
          const rows = m.requirements.filter((r) => r.match === g.id);
          if (!rows.length) return null;
          return (
            <details key={g.id} open={g.id !== "strong"} className="group rounded-xl border border-border bg-surface">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
                <span className={g.tone}>{g.icon}</span>
                <span className="text-sm font-bold text-foreground">{g.title}</span>
                <span className="rounded-full bg-surface-hover px-2 text-xs font-semibold tabular-nums text-muted">{rows.length}</span>
                <span className="hidden truncate text-xs text-faint md:inline">{g.hint}</span>
                <ChevronDown className="ml-auto size-4 text-faint transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-4 pb-2 text-xs text-faint md:hidden">{g.hint}</p>
              <table className="hidden w-full table-fixed border-t border-border text-sm md:table">
                <thead className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <tr><th className="w-[38%] px-4 py-2 font-semibold">Requirement</th><th className="w-[14%] px-2 py-2 font-semibold">Importance</th><th className="px-4 py-2 font-semibold">Your evidence</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.requirement} className="align-top">
                      <td className="px-4 py-2.5 font-medium text-foreground">{r.requirement}{r.jdSignal && <span className="mt-0.5 block text-xs font-normal text-faint">JD: {r.jdSignal}</span>}</td>
                      <td className="px-2 py-2.5 text-xs capitalize text-muted">{r.importance || "—"}</td>
                      <td className="px-4 py-2.5"><Evidence r={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-border border-t border-border md:hidden">
                {rows.map((r) => (
                  <li key={r.requirement} className="px-4 py-3 text-sm">
                    <p className="font-medium text-foreground">{r.requirement}</p>
                    <p className="mt-0.5 text-xs capitalize text-faint">{r.importance}</p>
                    <div className="mt-1"><Evidence r={r} /></div>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export function ReportActionPlan({ m }: { m: ReportModel }) {
  if (m.state === "failed") return null;
  const helps = m.gaps.filter((g) => g.mitigation).slice(0, 3);
  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5 max-sm:p-4" aria-label="Action plan">
      <h2 className="text-lg font-extrabold tracking-tight text-foreground">What to do</h2>
      {m.nextAction && <p className="mt-1 text-[15px] text-foreground">{m.nextAction}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {m.verifyFirst.length > 0 && <div><h3 className="text-xs font-bold uppercase tracking-[0.12em] text-faint">Check first</h3><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">{m.verifyFirst.map((x) => <li key={x}>{x}</li>)}</ol></div>}
        {helps.length > 0 && <div><h3 className="text-xs font-bold uppercase tracking-[0.12em] text-faint">If you go ahead</h3><ul className="mt-2 space-y-2 text-sm text-foreground">{helps.map((g) => <li key={g.title}><span className="font-semibold">{g.title.replace(/\s*\(.*\)$/, "")}:</span> <span className="text-muted">{g.mitigation}</span></li>)}</ul></div>}
        {m.emphasise.length > 0 && <div><h3 className="text-xs font-bold uppercase tracking-[0.12em] text-faint">Emphasise in your resume</h3><ul className="mt-2 space-y-1.5 text-sm text-muted">{m.emphasise.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      </div>
      <p className="mt-4 flex items-start gap-1.5 text-xs text-faint"><Info className="mt-0.5 size-3.5 shrink-0" /> Use only experience you actually have. Tailored resumes and cover letters are built from your verified profile.</p>
    </section>
  );
}

export function ReportDetailsMeta({ m }: { m: ReportModel }) {
  const rows: [string, string][] = [["Evaluated on", m.date], ["Posting check", m.verification], ["Posting legitimacy", m.legitimacy], ["Risk", m.risk], ["Confidence", [m.confidence, m.confidenceWhy].filter(Boolean).join(" — ")],
    ...Object.entries(m.scoreEvidence).map(([k, v]) => [`Evidence: ${k.replace(/_/g, " ")}`, v] as [string, string])].filter(([, v]) => v) as [string, string][];
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[12rem_1fr]">
      {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-faint">{k}</dt><dd className="text-foreground">{v}</dd></div>)}
      {m.problems.length > 0 && <div className="contents"><dt className="text-faint">Problems</dt><dd className="text-amber-700 dark:text-amber-300">{m.problems.join(" ")}</dd></div>}
    </dl>
  );
}
