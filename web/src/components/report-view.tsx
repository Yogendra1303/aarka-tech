import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink, ChevronDown } from "lucide-react";
import type { Application } from "@/lib/career-ops";
import { Badge } from "@/components/ui/badge";
import { scoreTone, legitimacyTone, parseReport } from "@/lib/format";
import {
  APPLY_LINE,
  applyCtaQuiet,
  applyLineLabel,
  cleanHeading,
  isLeadSection,
  isVerdictHeading,
  sectionPreview,
  splitSections,
  verdictReason,
} from "@/lib/report-sections.mjs";
import { StatusSelect } from "@/components/status-select";
import { CompanyLogo } from "@/components/company-logo";
import { ScoreMethodology } from "@/components/score-methodology";
import { ScoreLevers } from "@/components/score-levers";
import { PrepPack } from "@/components/prep-pack";
import { GeneratePdfButton } from "@/components/generate-pdf-button";
import { CoverDraftButton } from "@/components/cover-draft-button";
import { ApplyButton } from "@/components/apply-button";
import { MarkPdfReadyButton } from "@/components/mark-pdf-ready-button";
import { DeleteFromTracker } from "@/components/delete-from-tracker";
import { ReportMarkdown } from "@/components/report-markdown";
import { KeywordCoverage } from "@/components/keyword-coverage";
import { CompanyEvidence } from "@/components/company-evidence";
import { companyPresentation } from "@/lib/company-presentation.mjs";
import { PageFrame } from "@/components/page-frame";
import { parseReportModel } from "@/lib/arka/report-model";
import { ReportActionPlan, ReportCoverage, ReportDecisionHeader, ReportDetailsMeta, ReportFitSummary } from "@/components/arka-report-summary";
import { MarkAppliedButton } from "@/components/arka-mark-applied";

// Progressive disclosure of the report. Current oferta.md writes letter F as
// Interview Plan (STAR+R), not a verdict — never promote by letter (#3416).
// The score + 4.0 apply line + legitimacy live in one Peak-End callout (#4203).
// Block B (CV Match) stays open; everything else, including Role Summary and
// STAR+R, is collapsed (#4205). Machine artifacts stay in the Technical tier.

function isMachine(heading: string): boolean {
  return /machine summary|submitted|submit[-\s]?log/i.test(heading);
}

function httpUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : undefined;
}

export function ReportView({
  id,
  app,
  report,
  canDelete = false,
  pdfReadyFromIndex = false,
  coverReady = false,
  backHref = "/pipeline",
  applyHref,
  reportNum = null,
}: {
  id: string;
  app: Application | null;
  report: string | null;
  /** kept in the props contract (the page passes it) but no longer surfaced —
   *  the raw .md filename is a dev artifact, not header content. */
  file?: string | null;
  canDelete?: boolean;
  pdfReadyFromIndex?: boolean;
  /** A tailored cover letter for THIS application exists in output/ (resolved by
   *  the page, see resolveTailoredCover). The page drafts letters through the
   *  cover run but does not render them, so this link only finds CLI PDFs. */
  coverReady?: boolean;
  backHref?: string;
  applyHref?: string;
  reportNum?: number | null;
}) {
  const meta = report ? parseReport(report) : null;
  const field = (label: string) => meta?.fields.find((f) => f.label === label)?.value;
  const score = app?.score || field("Score");
  const date = app?.date || field("Date");
  const archetype = field("Archetype");
  const url = field("URL");
  const decision = field("Decision");
  const line = applyLineLabel(score ?? "", meta?.legitimacy);
  const recommended = line === "Recommended";
  const quietApply = applyCtaQuiet({ score, legitimacy: meta?.legitimacy });
  const applyUrl = httpUrl(url);
  const pdfReady = (app?.pdf ?? "").includes("✅") || pdfReadyFromIndex;
  const company = app ? companyPresentation(app) : null;
  const companyName = company?.label ?? app?.company ?? meta?.title ?? id;

  const model = report ? parseReportModel(report) : null;
  const pill = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:border-brand/40 hover:text-brand-text min-h-9 max-sm:min-h-[44px]";
  const actions = (
    <>
      {app && <StatusSelect n={id} current={app.status} />}
      <GeneratePdfButton n={id} company={app?.company ?? meta?.title ?? id} pdfReady={pdfReady} />
      {app && report && <CoverDraftButton n={id} company={companyName} />}
      {applyHref && <Link href={applyHref} className={pill}>Application answers</Link>}
      {app && <MarkAppliedButton n={id} current={app.status} />}
      <MarkPdfReadyButton reportNum={reportNum} ready={pdfReady} />
      {coverReady && (
        <a href={`/api/cover-pdf?application=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer" className={pill}>
          <FileText className="size-3.5" /> View cover letter
        </a>
      )}
    </>
  );
  const companyHeading = (
    <div className="flex items-center gap-3">
      <CompanyLogo name={company?.logoName ?? meta?.title ?? `Report #${id}`} size={40} />
      <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-foreground">{company?.label ?? meta?.title ?? `Report #${id}`}</h1>
      <span className="font-mono text-xs text-faint">#{id}</span>
    </div>
  );

  return (
    <PageFrame className="max-w-5xl">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand">
        <ArrowLeft className="size-4" /> Applications
      </Link>

      {report && model ? (
        <>
          <ReportDecisionHeader m={model} company={companyHeading} role={app?.role} actions={actions} />
          <ReportFitSummary m={model} />
          <ReportCoverage m={model} />
          <ReportActionPlan m={model} />
          {(() => {
            const { sections } = splitSections(meta?.body ?? report);
            const machine = sections.filter((s) => isMachine(s.heading));
            const mainSections = sections.filter((s) => !isMachine(s.heading) && !isVerdictHeading(s.heading));
            return (
              <>
                <h2 className="mt-8 text-sm font-bold uppercase tracking-[0.12em] text-faint">Full evaluation</h2>
                <ScoreLevers report={report} />
                {mainSections.map((s, i) => (
                  <details key={i} className="group mt-2 overflow-hidden rounded-xl border border-border bg-surface/40">
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-hover">
                      <span className="text-sm font-semibold">{cleanHeading(s.heading)}</span>
                      <span className="hidden truncate text-xs text-faint sm:inline">{sectionPreview(s.content)}</span>
                      <ChevronDown className="ml-auto size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="report-prose border-t border-border px-4 py-3"><ReportMarkdown>{s.content}</ReportMarkdown></div>
                  </details>
                ))}
                <PrepPack report={report} company={companyName} />
                <KeywordCoverage reportId={id} />
                {app?.company && <CompanyEvidence company={app.company} />}
                <details className="group mt-6 overflow-hidden rounded-xl border border-border/60 bg-surface/20">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-muted hover:bg-surface-hover">
                    Evaluation details
                    <ChevronDown className="ml-auto size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-4 border-t border-border/60 px-4 py-4">
                    <ReportDetailsMeta m={model} />
                    {machine.map((s, i) => (
                      <details key={i} className="rounded-lg border border-border/60">
                        <summary className="cursor-pointer px-3 py-2 font-mono text-xs text-muted">{cleanHeading(s.heading)}</summary>
                        <div className="report-prose border-t border-border/60 px-3 py-2"><ReportMarkdown>{s.content}</ReportMarkdown></div>
                      </details>
                    ))}
                    <ScoreMethodology />
                    {app && canDelete && <DeleteFromTracker n={id} />}
                  </div>
                </details>
              </>
            );
          })()}
        </>
      ) : (
        <>
          <header className="mt-5">
            {companyHeading}
            {app?.role && <p className="mt-1 text-muted">{app.role}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">{actions}</div>
            {applyUrl && <a href={applyUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:underline">Open original posting <ExternalLink className="size-3" /></a>}
            {app && canDelete && <div className="mt-3"><DeleteFromTracker n={id} /></div>}
          </header>
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/30 p-5 text-sm text-muted">
            <FileText className="size-5 shrink-0 text-faint" />
            No evaluation report yet for #{id}. Evaluate the job to see your fit.
          </div>
        </>
      )}
    </PageFrame>
  );
}
