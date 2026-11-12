"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Plus, Check, Loader2, ShieldQuestion, Sparkles, Coins, Star, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { instrumentSerif } from "@/lib/fonts";
import { ATS_LABEL, type AtsSource, type DiscoveredOffer } from "@/lib/explore";
import { cityName, cleanTitle, companyName } from "@/lib/arka/normalize.mjs";
import { countryOf, isKnownCity } from "@/lib/arka/places.mjs";
import { useExplorePrefs } from "./use-explore-prefs";
import Link from "next/link";
import { MarkAppliedButton } from "@/components/arka-mark-applied";
import { CHINA_SOURCES, EMPLOYER_LABEL } from "@/lib/employer-preset.mjs";
import { useJobs } from "@/components/jobs/job-store";
import { useExplore } from "./explore-provider";

function freshness(postedAt: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedAt)) return "";
  const days = Math.max(0, Math.round((Date.now() - new Date(postedAt + "T00:00:00Z").getTime()) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`;
}

// Real company logo (favicon) via the localhost proxy, cached on disk FOREVER per
// company — so once it resolves it's instant for this card AND every other card,
// this search or any future one. Falls back to a monogram on miss.
function Logo({ company }: { company: string }) {
  const [failed, setFailed] = useState(false);
  const letter = (company || "?").trim().charAt(0).toUpperCase();
  if (failed || !company.trim()) {
    return <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-semibold text-brand">{letter}</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/logo?company=${encodeURIComponent(company)}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-9 shrink-0 rounded-lg border border-border bg-surface object-contain p-1"
    />
  );
}

// What a running worker is doing on this exact posting → the live CTA label.
const WORKER_LABEL: Record<string, string> = { evaluate: "Evaluating…", pdf: "Preparing CV…", research: "Researching…", apply: "Filling…" };

// Board/API identifiers → names people know.
const SOURCE_LABEL: Record<string, string> = {
  "smartrecruiters-api": "SmartRecruiters", smartrecruiters: "SmartRecruiters", "greenhouse-api": "Greenhouse", greenhouse: "Greenhouse",
  "ashby-api": "Ashby", ashby: "Ashby", "lever-api": "Lever", lever: "Lever", "workday-api": "Workday", workday: "Workday",
  "rippling-api": "Rippling", "amazon-api": "Amazon Jobs", "workable-api": "Workable", "ai-search": "AI web search", "whats-new": "Saved scan", manual: "Added by you",
};
export function sourceLabel(ats: string) { return SOURCE_LABEL[ats] ?? (ATS_LABEL[ats as AtsSource] || ats.replace(/-api$/, "").replace(/\b\w/g, (c) => c.toUpperCase())); }
// A place people recognise: the city when we know it, else the country, else the raw text.
function placeLabel(loc: string) {
  if (!loc) return "Location not stated";
  const city = cityName(loc);
  if (isKnownCity(city) || city === "Remote") return city;
  const country = countryOf(loc);
  return /unknown/i.test(country) ? city : /\d/.test(city) || city.length > 24 ? country : `${city}, ${country}`;
}

export function DiscoveryCard({ offer, inPipeline, evaluatedN, appStatus }: { offer: DiscoveredOffer; inPipeline: boolean; evaluatedN?: string; appStatus?: string }) {
  const { added, adding, addToPipeline } = useExplore();
  const { isFavourite, toggleFavourite, dismiss } = useExplorePrefs();
  const fav = isFavourite(offer.company);
  const { jobs, startJob } = useJobs();

  // GLOBAL worker awareness: any worker acting on this URL drives the CTA, here
  // and on every other surface that renders this offer (the jobs store is global).
  const job = useMemo(
    () => jobs.filter((j) => j.input === offer.url).sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs, offer.url],
  );
  const working = job?.status === "running";
  const doneEval = job?.status === "done" && job.kind === "evaluate";
  const statusLabel = WORKER_LABEL[job?.kind ?? ""] ?? "Working…";

  const isAdded = added.has(offer.url) || inPipeline || working || doneEval;
  const isAdding = adding.has(offer.url);
  const unverified = offer.verification === "unconfirmed";
  const employer = CHINA_SOURCES.includes(offer.source);
  const fresh = freshness(offer.postedAt) || offer.postedHint || "";

  // Check the posting can be read (free, no AI) before spending AI usage: aggregator and
  // sign-in pages often can't be, and an evaluation of an unreadable page fails after the spend.
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState("");
  const evaluate = async () => {
    setBlocked(""); setChecking(true);
    const r = await fetch("/api/arka/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze", url: offer.url }) })
      .then((x) => x.json()).catch(() => null) as { needsPaste?: boolean; reason?: string; error?: string } | null;
    setChecking(false);
    if (r?.needsPaste || r?.error) { setBlocked(r.reason || r.error || "This posting can't be read."); return; }
    addToPipeline([offer]); // evaluating implies it's in the pipeline — record it
    startJob({ title: `Evaluate · ${offer.company}`, subtitle: offer.title, kind: "evaluate", input: offer.url, page: "/explore" });
  };

  return (
    <div className="co-rise group flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-surface/40 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-sm">
      <div className="flex items-start gap-3">
        {employer ? <div aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">{offer.company.charAt(0)}</div> : <Logo company={companyName(offer.company)} />}
        <a href={offer.url} target="_blank" rel="noopener noreferrer" className="block min-w-0 flex-1 max-sm:min-h-[44px]">
          <h3 title={offer.title} className={`${instrumentSerif.className} break-words text-[17px] leading-snug text-foreground transition-colors group-hover:text-brand`}>{cleanTitle(offer.title)}</h3>
          <p className="mt-1 break-words text-[13px] leading-snug text-muted">
            <span className="font-medium text-foreground/80" title={offer.company !== companyName(offer.company) ? offer.company : undefined}>{companyName(offer.company)}</span>
            <span className="text-faint" title={offer.location || undefined}> · {placeLabel(offer.location)}</span>
          </p>
        </a>
        <span className="-m-1 flex shrink-0 items-center">
          <a href={offer.url} target="_blank" rel="noopener noreferrer" title={offer.url} aria-label={`Open the posting for ${offer.title}`} className="inline-flex items-center justify-center rounded p-1 text-faint transition-colors hover:text-foreground max-sm:min-h-[44px] max-sm:min-w-[40px]"><ExternalLink className="size-4" /></a>
          <button type="button" onClick={() => void toggleFavourite(offer.company)} aria-pressed={fav}
            title={fav ? `Remove ${companyName(offer.company)} from favourites` : `Add ${companyName(offer.company)} to favourites`}
            aria-label={fav ? `Remove ${companyName(offer.company)} from favourite companies` : `Add ${companyName(offer.company)} to favourite companies`}
            className={cn("inline-flex items-center justify-center rounded p-1 transition-colors max-sm:min-h-[44px] max-sm:min-w-[40px]", fav ? "text-brand" : "text-faint hover:text-brand")}>
            <Star className={cn("size-4", fav && "fill-current")} />
          </button>
          {!inPipeline && !evaluatedN && (
            <button type="button" onClick={() => void dismiss(offer.url)} title="Dismiss — hide this job from results" aria-label={`Dismiss ${offer.title}`}
              className="inline-flex items-center justify-center rounded p-1 text-faint transition-colors hover:text-red-600 max-sm:min-h-[44px] max-sm:min-w-[40px]">
              <X className="size-4" />
            </button>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded border border-border px-1.5 py-0.5 font-medium text-muted" title={`Source: ${offer.ats}`}>{EMPLOYER_LABEL[offer.ats as keyof typeof EMPLOYER_LABEL] ?? sourceLabel(offer.ats)}</span>
        {(fresh || employer) && <span className="text-faint">{fresh || "Posting date unknown"}</span>}
        {unverified && (
          <span
            className="inline-flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-300"
            title="Found by AI on the public web — we can't confirm it's still live without opening it. Evaluating runs a real browser check and sets the verdict."
          >
            <ShieldQuestion className="size-3" /> unverified
          </span>
        )}
        {offer.matchedKeyword && (
          <span className="text-faint" title="Keyword match — not yet scored. Evaluate to get an A–F fit score.">
            · matched <span className="text-brand/80">{offer.matchedKeyword}</span>
          </span>
        )}
        {offer.fit && (
          <span
            className={cn(
              "rounded border px-1 py-0.5 text-[11px] font-medium",
              offer.fit.band === "strong"
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "text-faint",
            )}
            title="Free keyword-level estimate: posting title vs your profile's target roles (config/profile.yml). Not an evaluation — Evaluate still gives the real A–F fit score."
          >
            · {offer.fit.band} fit
          </span>
        )}
      </div>

      {/applied|interview|offer/i.test(appStatus || "") && <span className="w-fit rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">You applied · {appStatus}</span>}
      {blocked && (
        <p role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[12px] text-amber-800 dark:text-amber-200">
          {blocked} No AI was used. <Link href={`/add-job?url=${encodeURIComponent(offer.url)}`} className="font-semibold underline">Paste the description in Add a Job</Link>
        </p>
      )}
      {offer.why && (
        <p className="flex items-start gap-1.5 text-[12px] leading-snug text-brand/80">
          <Sparkles className="mt-0.5 size-3 shrink-0" />
          {offer.why}
        </p>
      )}

      <div className="mt-0.5">
        {evaluatedN || doneEval ? (
          <a
            href={evaluatedN ? `/pipeline/${evaluatedN}` : job ? `/jobs/${job.id}` : "/pipeline?tab=INBOX"}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-soft px-2.5 py-2 text-xs font-medium text-brand max-sm:min-h-[44px]"
          >
            <Check className="size-3.5" /> Evaluated · view report
          </a>
        ) : working ? (
          <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-brand/30 bg-brand-soft/60 px-2.5 py-2 text-xs font-medium text-brand">
            <Loader2 className="size-3.5 animate-spin" />
            {statusLabel}
            <span className="text-brand/60">· saved</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
            <Link href={`/add-job?url=${encodeURIComponent(offer.url)}&from=explore`} className="inline-flex items-center justify-center rounded-md border border-border px-2.5 py-2 text-xs font-medium text-foreground hover:border-brand/40 max-sm:min-h-[44px]">
              View details
            </Link>
            <button
              type="button"
              disabled={isAdded || isAdding}
              onClick={() => addToPipeline([offer])}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-center text-xs font-medium transition-colors max-sm:min-h-[44px]",
                isAdded ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-surface-hover text-foreground hover:bg-brand-soft hover:text-brand",
              )}
            >
              {isAdding ? <Loader2 className="size-3.5 animate-spin" /> : isAdded ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
              {isAdded ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => void evaluate()}
              disabled={checking}
              title={unverified ? "Runs a real evaluation — and verifies the posting is live. Uses tokens." : "Runs a real A–F evaluation. Uses tokens."}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-brand/30 px-2.5 py-2 text-xs font-medium text-brand transition-colors hover:bg-brand-soft max-sm:min-h-[44px]"
            >
              {checking ? <><Loader2 className="size-3.5 animate-spin" /> Checking…</> : <>Evaluate <Coins className="size-3.5 opacity-80" /></>}
            </button>
            {!/applied|interview|offer/i.test(appStatus || "") && <MarkAppliedButton compact block url={offer.url} company={companyName(offer.company)} role={cleanTitle(offer.title)} location={offer.location} source="explore" />}
          </div>
        )}
      </div>
    </div>
  );
}
