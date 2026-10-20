"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Clock, Globe2, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ATS_LABEL, ATS_SOURCES, cleanChips, type AtsSource, type ExploreFilters } from "@/lib/explore";
import { CHINA_PRESET } from "@/lib/employer-preset.mjs";
import { COUNTRIES, PLACES, ROLE_SUGGESTIONS } from "@/lib/arka/places.mjs";
import { CompanyTargeting } from "./company-targeting";

const RECENCY = [
  { label: "Today", days: 1 },
  { label: "3 days", days: 3 },
  { label: "This week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "This month", days: 30 },
];

// A search field that turns what you pick into removable tags, with suggestions as you type.
// Split only on unambiguous separators (comma, semicolon, newline) so "New York" stays one tag.
function TagSearch({ label, icon, values, onChange, suggestions, placeholder, tone = "include", foldAfter = 8 }: {
  label: string; icon: React.ReactNode; values: string[]; onChange: (v: string[]) => void;
  suggestions: string[]; placeholder: string; tone?: "include" | "exclude"; foldAfter?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [focus, setFocus] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const lower = useMemo(() => new Set(values.map((v) => v.toLowerCase())), [values]);
  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const pool = suggestions.filter((s) => !lower.has(s.toLowerCase()));
    return (q ? pool.filter((s) => s.toLowerCase().includes(q)) : pool).slice(0, 8);
  }, [draft, suggestions, lower]);
  const add = (text: string) => { onChange(cleanChips([...values, ...text.split(/[,\n;\t\r]+/)])); setDraft(""); };
  const shown = showAll || values.length <= foldAfter + 2 ? values : values.slice(0, foldAfter);
  const chip = tone === "include" ? "bg-foreground text-background" : "bg-red-500/10 text-red-700 ring-1 ring-red-500/30 dark:text-red-300";
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">{icon}{label}</label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-2 focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/15">
        {shown.map((v) => (
          <span key={v} className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-medium", chip)}>
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="opacity-70 hover:opacity-100 max-sm:min-h-[32px] max-sm:min-w-[24px]"><X className="size-3" /></button>
          </span>
        ))}
        {values.length > foldAfter + 2 && (
          <button type="button" onClick={() => setShowAll((x) => !x)} className="rounded-lg border border-dashed border-border px-2 py-1 text-[12px] font-semibold text-muted hover:text-foreground">
            {showAll ? "Show fewer" : `+${values.length - foldAfter} more`}
          </button>
        )}
        <input id={id} value={draft} placeholder={values.length ? "Add another…" : placeholder}
          onChange={(e) => { const v = e.target.value; if (/[,\n;]$/.test(v)) add(v); else setDraft(v); }}
          onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => { setFocus(false); if (draft.trim()) add(draft); }, 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) { e.preventDefault(); add(matches[0] && matches[0].toLowerCase().startsWith(draft.trim().toLowerCase()) ? matches[0] : draft); }
            else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
          }}
          onPaste={(e) => { const t = e.clipboardData.getData("text"); if (/[,;\n\t\r]/.test(t)) { e.preventDefault(); add(draft + t); } }}
          className="min-w-[9rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-faint" />
      </div>
      {focus && matches.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
          {matches.map((m) => (
            <li key={m}><button type="button" role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); add(m); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-brand-soft">{m}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Country → city picker for people who'd rather browse than type.
function CountryCityPicker({ onAdd }: { onAdd: (place: string) => void }) {
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const cities = COUNTRIES.find((c) => c.name === country)?.cities ?? [];
  const sel = "min-h-8 rounded-lg border border-border bg-surface px-2 text-xs text-foreground";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <select aria-label="Country" value={country} onChange={(e) => { setCountry(e.target.value); setCity(""); }} className={sel}>
        <option value="">Browse by country…</option>
        {[...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.name}>{c.name}</option>)}
      </select>
      {country && (
        <select aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} className={sel}>
          <option value="">Whole country</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
      )}
      {country && <button type="button" onClick={() => { onAdd(city || country); setCountry(""); setCity(""); }} className="min-h-8 rounded-lg bg-foreground px-3 text-xs font-semibold text-background">Add</button>}
    </div>
  );
}

export function FilterBuilder({
  filters,
  onChange,
  seededFrom = [],
  disabled = false,
  showTargeting = false,
}: {
  filters: ExploreFilters;
  onChange: (f: ExploreFilters) => void;
  seededFrom?: string[];
  disabled?: boolean;
  showTargeting?: boolean;
}) {
  const employer = filters.preset === CHINA_PRESET;
  const [advanced, setAdvanced] = useState(false);
  const set = (patch: Partial<ExploreFilters>) => onChange({ ...filters, ...patch });
  // The employer-specific preset is no longer offered; a search saved with it falls back to the public network.
  useEffect(() => { if (employer) onChange({ ...filters, preset: undefined, employers: undefined }); }, [employer]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleAts = (a: AtsSource) => {
    const next = filters.ats.includes(a) ? filters.ats.filter((x) => x !== a) : [...filters.ats, a];
    set({ ats: next.length ? next : filters.ats });
  };
  const anywhere = filters.allow.length === 0;
  const remoteOnly = filters.allow.length === 1 && filters.allow[0].toLowerCase() === "remote";
  const advancedCount = filters.negative.length + filters.block.length + filters.blockHard.length + filters.alwaysAllow.length;

  return (
    <fieldset disabled={disabled} className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <TagSearch label="What role?" icon={<Search className="size-3.5 text-muted" />} values={filters.positive} onChange={(v) => set({ positive: v })}
            suggestions={ROLE_SUGGESTIONS} placeholder="e.g. Operations, Customer Success, Growth" />
          <p className="mt-1 text-[11px] text-faint">
            {filters.positive.length === 0 ? "Leave empty to see every new posting." : "A job matches if its title contains any of these."}
            {seededFrom.length > 0 && filters.positive.length > 0 ? ` Started from your ${seededFrom.join(" and ")}.` : ""}
          </p>
        </div>
        <div>
          <TagSearch label="Where?" icon={<MapPin className="size-3.5 text-muted" />} values={filters.allow} onChange={(v) => set({ allow: v })}
            suggestions={PLACES} placeholder="Any city or country, worldwide" />
          <CountryCityPicker onAdd={(p) => set({ allow: cleanChips([...filters.allow, p]) })} />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => set({ allow: [] })} aria-pressed={anywhere}
              className={cn("inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold max-sm:min-h-[40px]", anywhere ? "border-brand/50 bg-brand-soft text-brand-text" : "border-border text-muted hover:text-foreground")}>
              <Globe2 className="size-3" /> Anywhere in the world
            </button>
            <button type="button" onClick={() => set({ allow: ["Remote"] })} aria-pressed={remoteOnly}
              className={cn("rounded-lg border px-2.5 py-1 text-xs font-semibold max-sm:min-h-[40px]", remoteOnly ? "border-brand/50 bg-brand-soft text-brand-text" : "border-border text-muted hover:text-foreground")}>
              Remote only
            </button>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-foreground"><Clock className="size-3.5 text-muted" /> Posted</p>
        <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface p-1">
          {RECENCY.map((r) => (
            <button key={r.days} type="button" onClick={() => set({ sinceDays: r.days })} aria-pressed={filters.sinceDays === r.days}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors max-sm:min-h-[40px]", filters.sinceDays === r.days ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground")}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {showTargeting && <CompanyTargeting />}

      <div className="rounded-xl border border-border bg-surface/40">
        <button type="button" onClick={() => setAdvanced((v) => !v)} aria-expanded={advanced} className="flex w-full items-center gap-2 px-4 py-3 text-[13px] font-semibold text-foreground max-sm:min-h-[44px]">
          <SlidersHorizontal className="size-3.5 text-muted" /> More filters
          {advancedCount > 0 && <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] text-muted">{advancedCount} active</span>}
          <ChevronDown className={cn("ml-auto size-4 text-muted transition-transform", advanced && "rotate-180")} />
        </button>
        {advanced && (
          <div className="space-y-4 border-t border-border p-4">
            <TagSearch label="Hide jobs whose title mentions" icon={null} tone="exclude" values={filters.negative} onChange={(v) => set({ negative: v })}
              suggestions={["Intern", "Junior", "Associate", "Engineer", "Developer", "Contract", "Part-time", "Freelance"]} placeholder="e.g. Intern, Junior, Engineer" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TagSearch label="Never show jobs in" icon={null} tone="exclude" values={filters.blockHard} onChange={(v) => set({ blockHard: v })} suggestions={PLACES} placeholder="Places to rule out" />
              <TagSearch label="Hide unless also listed in Where" icon={null} tone="exclude" values={filters.block} onChange={(v) => set({ block: v })} suggestions={PLACES} placeholder="Softer location filter" />
            </div>
            <TagSearch label="Always keep jobs that mention" icon={null} values={filters.alwaysAllow} onChange={(v) => set({ alwaysAllow: v })} suggestions={PLACES} placeholder="Rescues a posting that lists several locations" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-foreground">Job boards to search</p>
                <div className="flex flex-wrap gap-1.5">
                  {ATS_SOURCES.map((a) => {
                    const on = filters.ats.includes(a);
                    return <button key={a} type="button" aria-pressed={on} onClick={() => toggleAts(a)} className={cn("rounded-lg border px-2.5 py-1 text-xs font-semibold max-sm:min-h-[40px]", on ? "border-brand/50 bg-brand-soft text-brand-text" : "border-border text-muted")}>{ATS_LABEL[a]}</button>;
                  })}
                </div>
              </div>
              <div>
                <p className="mb-1.5 flex justify-between text-[13px] font-semibold text-foreground">How deep to search <span className="font-normal text-faint">{filters.limitPerAts} companies per board</span></p>
                <input type="range" min={50} max={500} step={50} value={filters.limitPerAts} aria-label="How deep to search" onChange={(e) => set({ limitPerAts: Number(e.target.value) })} className="w-full accent-brand" />
              </div>
            </div>
          </div>
        )}
      </div>
    </fieldset>
  );
}
