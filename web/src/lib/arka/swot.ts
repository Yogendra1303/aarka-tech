import fs from "node:fs";
import path from "node:path";
import type { ReportModel } from "@/lib/arka/report-model";

// Profile-level SWOT, computed from your career records and evaluation reports. Deterministic:
// no AI call. Every item names its evidence. A gap seen in a single posting is not a career
// weakness; it stays on that job's report. Threats need the same constraint in 2+ postings.

type Rec = Record<string, unknown>;
export type SwotItem = { text: string; evidence: string; scope: "profile" | "across jobs"; inference?: boolean };
export type Swot = {
  strengths: SwotItem[]; weaknesses: SwotItem[]; opportunities: SwotItem[]; threats: SwotItem[];
  meta: { updated: string | null; profileVersion: string; jobs: number; jobRange: string; stale: boolean; staleWhy: string };
  jobSpecific: { company: string; role: string; n: string; gaps: number }[];
};

const FAMILIES: { name: string; re: RegExp }[] = [
  { name: "An advanced degree (postgraduate / MBA) is asked for", re: /postgraduate|\bmba\b|master'?s|\bphd\b|advanced degree/i },
  { name: "Postings ask for more years than your profile shows", re: /\b\d+\s*\+?\s*(?:[–-]\s*\d+\s*)?(?:years|yrs)\b.*(?:vs|stated|exceed|cv)|experience floor|total experience/i },
  { name: "Roles sit below your seniority (downlevel)", re: /downlevel|overqualif|below your|seniority mismatch|two levels/i },
  { name: "Industry or domain experience you don't show", re: /industry|domain|vertical|travel|fintech|logistics|supply chain|quick[- ]commerce|cpaas|telco|bpo|saas background/i },
  { name: "Relocation or fixed office location required", re: /relocat|on-?site|onsite|office base|place of posting|move to/i },
  { name: "Quota-carrying sales record asked for", re: /\bquota\b|revenue target|closed revenue|sales quota/i },
  { name: "Language requirement you don't list", re: /\b(arabic|french|german|spanish|mandarin)\b|language/i },
];

export function computeSwot(input: {
  achievements: Rec[]; skills: Rec[]; employment: Rec[]; projects: Rec[]; discrepancies: Rec[];
  reports: { company: string; role: string; n: string; date: string; model: ReportModel }[];
  kbDir: string; cvPath: string;
}): Swot {
  const ach = input.achievements;
  const achById = new Map(ach.map((a) => [String(a.id), a]));
  // Owner ids (EMP-…, POS-…, CON-…) → the employer or project name people recognise.
  const names = new Map<string, string>();
  for (const e of input.employment) { names.set(String(e.id), String(e.employer)); for (const p of (e.positions as Rec[]) || []) names.set(String(p.id), `${String(p.title || "")} at ${String(e.employer)}`.replace(/^ at /, "")); }
  for (const p of input.projects) names.set(String(p.id), String(p.name || p.client || ""));
  const owner = (a: Rec | undefined) => names.get(String(a?.owner || "")) || "";

  // Strengths: skills backed by 2+ sourced achievements, and achievements with a measurable result
  // that stays consistent across your resume versions.
  const strengths: SwotItem[] = input.skills
    .map((s) => ({ s, ev: ((s.evidence as string[]) || []).filter((id) => achById.has(id)) }))
    .filter((x) => x.ev.length >= 2).sort((a, b) => b.ev.length - a.ev.length).slice(0, 5)
    .map(({ s, ev }) => ({ text: String(s.name), scope: "profile" as const, evidence: `${ev.length} achievements, e.g. "${String(achById.get(ev[0])?.text || "")}"` }));
  for (const a of ach.filter((x) => x.metric && /consistent/.test(String(x.confidence || ""))).slice(0, 2))
    strengths.push({ text: String(a.text), scope: "profile", evidence: `Measured result (${a.metric}), ${a.confidence}${owner(a) ? ` · ${owner(a)}` : ""}` });

  // Weaknesses: gaps in the EVIDENCE your profile gives, not skills you're assumed to lack.
  const weaknesses: SwotItem[] = [];
  const noMetric = ach.filter((a) => !a.metric);
  if (noMetric.length) weaknesses.push({ text: `${noMetric.length} of ${ach.length} achievements have no measurable result`, scope: "profile", evidence: `e.g. "${String(noMetric[0].text).slice(0, 120)}". Adding a number (%, ₹, team size, time) makes them stronger.` });
  const unconfirmed = ach.filter((a) => /needs_confirmation|unconfirmed/.test(String(a.review_status || "")));
  if (unconfirmed.length) weaknesses.push({ text: `${unconfirmed.length} achievements are not confirmed yet`, scope: "profile", evidence: "Marked needs confirmation in your career records; tailored resumes treat them with care until you confirm them." });
  const openConf = input.discrepancies.filter((d) => !/resolved|closed/i.test(String(d.status || "")));
  if (openConf.length) weaknesses.push({ text: `${openConf.length} facts disagree between your resume versions`, scope: "profile", evidence: `e.g. ${String(openConf[0].issue || "")}. Resolve them in the Checklist so every document says the same thing.` });
  const projUnconf = input.projects.filter((p) => p.review_status === "needs_confirmation");
  if (projUnconf.length) weaknesses.push({ text: `${projUnconf.length} consulting projects lack confirmed dates or outcomes`, scope: "profile", evidence: "Unconfirmed projects are left out of tailored resumes until you confirm them in Employment & projects." });
  const toolsNoEv = input.skills.filter((s) => String(s.category) === "tool" && !((s.evidence as string[]) || []).length).map((s) => String(s.name));
  if (toolsNoEv.length) weaknesses.push({ text: `Tools listed without an example of use: ${toolsNoEv.slice(0, 5).join(", ")}`, scope: "profile", evidence: "No achievement in your records mentions them." });

  // Threats: the same constraint in 2+ evaluated postings, with count and date range.
  const threats: SwotItem[] = [];
  const reports = input.reports.filter((r) => r.model.state !== "failed");
  for (const f of FAMILIES) {
    const hits = reports.filter((r) => [...r.model.softGaps, ...r.model.hardStops, ...r.model.requirements.filter((q) => q.match !== "strong").map((q) => `${q.requirement} ${q.evidence}`)].some((g) => f.re.test(g)));
    if (hits.length >= 2) {
      const dates = hits.map((h) => h.date).filter(Boolean).sort();
      threats.push({ text: f.name, scope: "across jobs", evidence: `In ${hits.length} of ${reports.length} evaluated postings${dates.length ? ` (${dates[0]} to ${dates[dates.length - 1]})` : ""}: ${hits.slice(0, 3).map((h) => h.company).join(", ")}${hits.length > 3 ? "…" : ""}` });
    }
  }

  // Opportunities: inferences, labelled as such, with their basis.
  const opportunities: SwotItem[] = [];
  const byArch = new Map<string, number[]>();
  for (const r of reports) if (r.model.archetype && r.model.score != null) { const k = r.model.archetype.replace(/\s*\(.*\)$/, ""); byArch.set(k, [...(byArch.get(k) || []), r.model.score]); }
  const best = [...byArch.entries()].map(([k, v]) => ({ k, n: v.length, avg: v.reduce((a, b) => a + b, 0) / v.length })).sort((a, b) => b.avg - a.avg)[0];
  if (best) opportunities.push({ text: `Role type that scores best for you: ${best.k}`, evidence: `Average ${best.avg.toFixed(1)}/5 across ${best.n} evaluated posting${best.n === 1 ? "" : "s"}.`, scope: "across jobs", inference: true });
  const strongReq = new Map<string, number>();
  for (const r of reports) for (const q of r.model.requirements.filter((x) => x.match === "strong")) { const k = q.requirement.toLowerCase().split(/[,:(]/)[0].trim().slice(0, 60); strongReq.set(k, (strongReq.get(k) || 0) + 1); }
  const repeat = [...strongReq.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2);
  for (const [k, n] of repeat) opportunities.push({ text: `Employers keep asking for "${k}", and your profile matches it`, evidence: `Strong match in ${n} postings; lead with it.`, scope: "across jobs", inference: true });
  if (strengths[0]) opportunities.push({ text: `Lead applications with ${strengths[0].text}`, evidence: `Your best-evidenced strength (${strengths[0].evidence.split(",")[0]}).`, scope: "profile", inference: true });

  // Freshness.
  const mtime = (p: string) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
  const kbTimes = ["achievements.json", "skills.json", "employment.json"].map((f) => mtime(path.join(input.kbDir, f)));
  const cvTime = mtime(input.cvPath);
  const updated = Math.max(...kbTimes, cvTime);
  const stale = cvTime > Math.max(...kbTimes) + 60_000;
  const dates = reports.map((r) => r.date).filter(Boolean).sort();
  return {
    strengths, weaknesses, opportunities, threats,
    meta: {
      updated: updated ? new Date(updated).toISOString() : null,
      profileVersion: cvTime ? `resume of ${new Date(cvTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "no resume",
      jobs: reports.length, jobRange: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : "",
      stale, staleWhy: stale ? "Your resume changed after your career records were last rebuilt, so some items may be out of date." : "",
    },
    jobSpecific: input.reports.map((r) => ({ company: r.company, role: r.role, n: r.n, gaps: r.model.softGaps.length + r.model.hardStops.length })).filter((r) => r.gaps > 0),
  };
}
