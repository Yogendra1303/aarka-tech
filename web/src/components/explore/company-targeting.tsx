"use client";

import { useEffect, useState } from "react";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const STAGES = ["Early-stage startup", "Series A–B", "Series C+ / scale-up", "Unicorn", "Mid-size company", "Large enterprise / MNC", "Listed company", "Family business / conglomerate"];
const DOMAINS = ["SaaS / B2B software", "Fintech", "E-commerce / D2C", "EV / Mobility", "Logistics / Supply chain", "Quick commerce", "Healthtech", "Edtech", "Consumer internet", "Manufacturing", "Real estate / Proptech", "Telecom", "Travel / Hospitality", "Consulting"];

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

// The kinds of company the candidate is targeting. Saved to the profile so evaluations
// weigh them; the public job feeds don't publish company size or sector, so this does
// not hide any scan result on its own.
export function CompanyTargeting() {
  const [stages, setStages] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch("/api/arka/profile", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      setStages(split(j?.preferences?.company_stages || "")); setDomains(split(j?.preferences?.domains || ""));
    }).catch(() => {});
  }, []);
  const save = async (s: string[], d: string[]) => {
    setState("saving");
    try {
      const r = await fetch("/api/arka/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company_stages: s.join(", "), domains: d.join(", ") }) });
      setState(r.ok ? "saved" : "error");
    } catch { setState("error"); }
  };
  const toggle = (list: string[], v: string, which: "s" | "d") => {
    const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    if (which === "s") { setStages(next); void save(next, domains); } else { setDomains(next); void save(stages, next); }
  };
  const row = (opts: string[], list: string[], which: "s" | "d") => (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {opts.map((o) => {
        const on = list.includes(o);
        return (
          <button key={o} type="button" aria-pressed={on} onClick={() => toggle(list, o, which)}
            className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors max-sm:min-h-[40px]", on ? "border-brand/40 bg-brand-soft text-brand-text" : "border-border text-muted hover:text-foreground")}>
            {on ? "✓ " : ""}{o}
          </button>
        );
      })}
    </div>
  );
  return (
    <section className="rounded-xl border border-border bg-surface/40 p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
        <Building2 className="size-4 text-brand-text" />
        <h3 className="text-[13px] font-semibold text-foreground">Kind of company</h3>
        <span className="truncate text-xs text-muted">{stages.length + domains.length ? [...stages, ...domains].slice(0, 4).join(" · ") + (stages.length + domains.length > 4 ? " …" : "") : "Any stage, any industry"}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-faint" role="status">
          {state === "saving" ? <><Loader2 className="size-3 animate-spin" /> Saving</> : state === "saved" ? <><Check className="size-3" /> Saved to your profile</> : state === "error" ? "Could not save" : null}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <>
      <p className="mt-2 text-[11px] text-faint">Used when Aarka scores a role for you. Job boards don&apos;t publish company size or sector, so these don&apos;t hide scan results.</p>
      <p className="mt-3 text-[12px] font-medium text-muted">Company stage</p>
      {row(STAGES, stages, "s")}
      <p className="mt-3 text-[12px] font-medium text-muted">Domain / industry</p>
      {row(DOMAINS, domains, "d")}
      </>}
    </section>
  );
}
