"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Search, Plus, Star, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ATS_LABEL, type AtsSource, type DiscoveredOffer } from "@/lib/explore";
import { cityName, companyName, seniorityOf } from "@/lib/arka/normalize.mjs";
import { countryOf, employmentTypeOf, workModeOf } from "@/lib/arka/places.mjs";
import { CostBadge } from "@/components/cost/cost-badge";
import { DiscoveryCard } from "./discovery-card";
import { useExplore } from "./explore-provider";
import { useExplorePrefs } from "./use-explore-prefs";

export type EnrichedOffer = DiscoveredOffer & { inPipeline: boolean; evaluatedN?: string };

const PAGE = 24;
type Facet = "company" | "country" | "city" | "mode" | "type" | "level" | "fit" | "source" | "fresh";
const FACETS: { id: Facet; title: string }[] = [
  { id: "country", title: "Country" }, { id: "city", title: "City" }, { id: "mode", title: "Work mode" },
  { id: "level", title: "Seniority" }, { id: "type", title: "Employment type" }, { id: "fit", title: "Match to your profile" },
  { id: "company", title: "Company" }, { id: "source", title: "Job board" }, { id: "fresh", title: "Posted" },
];
const FIT_LABEL: Record<string, string> = { strong: "Strong match", related: "Related", weak: "Weak match" };
const age = (d: string) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 864e5) : NaN);
const freshOf = (o: DiscoveredOffer) => { const a = age(o.postedAt); return Number.isNaN(a) ? "Date not stated" : a <= 1 ? "Last 24 hours" : a <= 3 ? "Last 3 days" : a <= 7 ? "Last week" : "Older"; };
const facetOf = (o: EnrichedOffer, f: Facet): string => {
  switch (f) {
    case "company": return companyName(o.company);
    case "country": return countryOf(o.location);
    case "city": return cityName(o.location);
    case "mode": return workModeOf(`${o.location} ${o.title}`);
    case "type": return employmentTypeOf(o.title);
    case "level": return seniorityOf(o.title);
    case "fit": return o.fit ? FIT_LABEL[o.fit.band] : "Not rated";
    case "source": return ATS_LABEL[o.ats as AtsSource] ?? o.ats;
    case "fresh": return freshOf(o);
  }
};
const NONE: Record<Facet, string | null> = { company: null, country: null, city: null, mode: null, type: null, level: null, fit: null, source: null, fresh: null };

function FacetGroup({ title, entries, active, onPick }: { title: string; entries: [string, number][]; active: string | null; onPick: (v: string | null) => void }) {
  const [more, setMore] = useState(false);
  if (entries.length < 2 && !active) return null;
  const list = more ? entries : entries.slice(0, 6);
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">{title}</p>
      <ul className="space-y-0.5">
        {list.map(([v, n]) => (
          <li key={v}>
            <button type="button" aria-pressed={active === v} onClick={() => onPick(active === v ? null : v)}
              className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors", active === v ? "bg-brand-soft font-semibold text-brand-text" : "text-foreground hover:bg-surface-hover")}>
              <span className="truncate">{v}</span><span className="shrink-0 tabular-nums text-xs text-faint">{n}</span>
            </button>
          </li>
        ))}
      </ul>
      {entries.length > 6 && <button type="button" onClick={() => setMore((m) => !m)} className="mt-1 px-2 text-xs font-semibold text-brand-text hover:underline">{more ? "Show fewer" : `Show all ${entries.length}`}</button>}
    </div>
  );
}

// Favourite companies: managed here, separate from the role and location search.
function FavouritesPanel({ offers }: { offers: EnrichedOffer[] }) {
  const { prefs, removeFavourite, setAlerts, setPrioritize } = useExplorePrefs();
  const [open, setOpen] = useState(false);
  const counts = new Map<string, number>();
  for (const o of offers) { const c = companyName(o.company).toLowerCase(); counts.set(c, (counts.get(c) || 0) + 1); }
  return (
    <section className="rounded-xl border border-border bg-surface/60">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-foreground">
        <Star className="size-4 fill-current text-brand" /> Favourite companies <span className="rounded-full bg-surface-hover px-2 text-xs text-muted">{prefs.favourites.length}</span>
        <span className="ml-auto truncate text-xs font-normal text-muted">{prefs.favourites.length ? `${prefs.favourites.filter((f) => counts.get(f.name.toLowerCase())).length} hiring in these results` : "Tap ☆ on any job to add its company"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border p-3">
          <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={prefs.prioritizeFavourites} onChange={(e) => void setPrioritize(e.target.checked)} /> Show favourite companies first (other companies still appear)</label>
          {prefs.favourites.length === 0 ? <p className="text-xs text-faint">No favourites yet.</p> : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {prefs.favourites.map((f) => (
                <li key={f.name} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{f.name}</span>
                  <span className="text-xs tabular-nums text-faint">{counts.get(f.name.toLowerCase()) || 0} here</span>
                  <button type="button" onClick={() => void setAlerts(f.name, !f.alerts)} aria-pressed={f.alerts} title={f.alerts ? "Alerts on: new roles show on your Dashboard" : "Alerts off"} aria-label={`${f.alerts ? "Turn off" : "Turn on"} alerts for ${f.name}`} className={cn("rounded-md border border-border p-1.5", f.alerts ? "text-brand" : "text-faint")}>
                    {f.alerts ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
                  </button>
                  <button type="button" onClick={() => void removeFavourite(f.name)} aria-label={`Remove ${f.name} from favourites`} className="rounded-md border border-border p-1.5 text-muted hover:text-red-600"><X className="size-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-faint">Removing a favourite keeps that company&apos;s saved jobs and applications. Alerts show new roles from these companies on your Dashboard.</p>
        </div>
      )}
    </section>
  );
}

export function ResultsList({ offers: all }: { offers: EnrichedOffer[] }) {
  const { companiesScanned, partial, error, addToPipeline, added, mode, running } = useExplore();
  const { prefs, isFavourite, undismissAll } = useExplorePrefs();
  const isAi = mode === "ai";
  const [sort, setSort] = useState<"fresh" | "company" | "fit">("fresh");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Record<Facet, string | null>>(NONE);
  const [shown, setShown] = useState(PAGE);
  const [showDismissed, setShowDismissed] = useState(false);

  const dismissed = useMemo(() => new Set(prefs.dismissed), [prefs.dismissed]);
  // Unique by URL, so results that arrive in several batches never repeat.
  const offers = useMemo(() => {
    const seen = new Set<string>();
    return all.filter((o) => (seen.has(o.url) ? false : (seen.add(o.url), true)) && (showDismissed || !dismissed.has(o.url)));
  }, [all, dismissed, showDismissed]);
  const hiddenCount = all.filter((o) => dismissed.has(o.url)).length;

  const matchesExcept = (o: EnrichedOffer, skip?: Facet) => (Object.keys(pick) as Facet[]).every((f) => f === skip || !pick[f] || facetOf(o, f) === pick[f]);
  const facet = (f: Facet) => {
    const m = new Map<string, number>();
    for (const o of offers) if (matchesExcept(o, f)) m.set(facetOf(o, f), (m.get(facetOf(o, f)) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = offers.filter((o) => matchesExcept(o));
    if (needle) list = list.filter((o) => `${o.title} ${o.company} ${companyName(o.company)} ${o.location}`.toLowerCase().includes(needle));
    return [...list].sort((a, b) => {
      if (prefs.prioritizeFavourites) { const d = Number(isFavourite(b.company)) - Number(isFavourite(a.company)); if (d) return d; }
      return sort === "fresh" ? (b.postedAt || "").localeCompare(a.postedAt || "")
        : sort === "fit" ? (b.fit?.score ?? -1) - (a.fit?.score ?? -1)
          : companyName(a.company).localeCompare(companyName(b.company));
    });
  }, [offers, q, sort, pick, prefs.prioritizeFavourites, prefs.favourites]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setShown(PAGE); }, [q, sort, pick]);

  const page = view.slice(0, shown);
  const addable = view.filter((o) => !o.inPipeline && !o.evaluatedN && !added.has(o.url));
  const activePicks = (Object.entries(pick) as [Facet, string | null][]).filter(([, v]) => v);
  const clearAll = () => { setPick(NONE); setQ(""); };
  const title = (f: Facet) => FACETS.find((x) => x.id === f)?.title;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground">
              {view.length.toLocaleString()} {isAi ? "candidates" : `job${view.length === 1 ? "" : "s"}`}
              {view.length !== offers.length && <span className="font-normal text-muted"> of {offers.length.toLocaleString()}</span>}
              <CostBadge kind={isAi ? "spend" : "free-network"} size="xs" className="ml-2 align-middle" />
            </p>
            <p className="text-[12px] text-faint">
              {isAi ? "Found by AI on the open web; unverified until you evaluate." : `${companiesScanned > 0 ? `${companiesScanned.toLocaleString()} companies searched · ` : ""}free${partial ? " · a few career pages didn't answer" : ""}${running ? " · still searching…" : ""}`}
            </p>
            {!isAi && error && <p className="text-[12px] text-amber-700 dark:text-amber-300">{error}</p>}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background/40 px-2.5">
              <Search className="size-3.5 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, company, place" aria-label="Search these results" className="w-48 bg-transparent text-[13px] outline-none placeholder:text-faint" />
            </span>
            <label className="flex items-center gap-1.5 text-xs text-muted">Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="min-h-9 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-foreground">
                <option value="fresh">Newest</option><option value="fit">Best match</option><option value="company">Company A–Z</option>
              </select>
            </label>
            {addable.length > 1 && (
              <button type="button" onClick={() => addToPipeline(addable)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:border-brand/40">
                <Plus className="size-3.5" /> Save all {addable.length} to pipeline
              </button>
            )}
          </div>
        </div>
        {(activePicks.length > 0 || q.trim()) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5 text-xs">
            <span className="text-muted">Filters:</span>
            {q.trim() && <button type="button" onClick={() => setQ("")} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand-text">“{q.trim()}” <X className="size-3" /></button>}
            {activePicks.map(([f, v]) => (
              <button key={f} type="button" onClick={() => setPick({ ...pick, [f]: null })} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand-text">{title(f)}: {v} <X className="size-3" /></button>
            ))}
            <button type="button" onClick={clearAll} className="ml-1 font-semibold text-brand-text hover:underline">Clear filters</button>
          </div>
        )}
      </div>

      {!isAi && <FavouritesPanel offers={offers} />}

      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        <aside className="space-y-4 self-start rounded-xl border border-border bg-surface/50 p-3 lg:sticky lg:top-4" aria-label="Narrow results">
          {FACETS.filter((f) => !(isAi && (f.id === "fit" || f.id === "source"))).map((f) => (
            <FacetGroup key={f.id} title={f.title} entries={facet(f.id)} active={pick[f.id]}
              onPick={(v) => setPick(f.id === "country" ? { ...pick, country: v, city: null } : { ...pick, [f.id]: v })} />
          ))}
          <p className="text-[11px] leading-snug text-faint">Salary, visa and time zone aren&apos;t published by these job boards, so they are left as unknown rather than guessed.</p>
          {hiddenCount > 0 && (
            <div className="border-t border-border pt-3 text-xs text-muted">
              {hiddenCount} dismissed
              <button type="button" onClick={() => setShowDismissed((s) => !s)} className="ml-2 font-semibold text-brand-text hover:underline">{showDismissed ? "Hide them" : "Show"}</button>
              {showDismissed && <button type="button" onClick={() => void undismissAll(all.filter((o) => dismissed.has(o.url)).map((o) => o.url))} className="ml-2 font-semibold text-brand-text hover:underline">Restore all</button>}
            </div>
          )}
        </aside>
        <div className="min-w-0">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {page.map((o) => <DiscoveryCard key={o.url} offer={o} inPipeline={o.inPipeline} evaluatedN={o.evaluatedN} />)}
          </div>
          {view.length === 0 && !running && (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted">
              Nothing matches these filters. <button type="button" onClick={clearAll} className="font-semibold text-brand-text hover:underline">Clear filters</button>
            </div>
          )}
          {view.length > shown && (
            <div className="mt-4 flex flex-col items-center gap-1">
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className="inline-flex min-h-10 items-center rounded-lg border border-border bg-surface px-5 text-sm font-semibold text-foreground hover:border-brand/40">Load {Math.min(PAGE, view.length - shown)} more</button>
              <p className="text-xs text-faint">Showing {shown} of {view.length}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
