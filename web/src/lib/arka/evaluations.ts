import * as yaml from "js-yaml";
import { readReport } from "@/lib/career-ops";

// The company-specific evaluation for each tracked role, read from the "Machine Summary"
// block every evaluation report ends with. Missing or unparseable reports give null.
export type Evaluation = {
  decision: string; archetype: string; legitimacy: string; risk: string;
  strengths: string[]; gaps: string[]; hardStops: string[]; location: string;
};

const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

export function evaluationFor(n: string): Evaluation | null {
  const r = readReport(n);
  if (!r) return null;
  const m = r.content.match(/## Machine Summary[\s\S]*?```ya?ml\n([\s\S]*?)```/);
  let y: Record<string, unknown> = {};
  if (m) { try { y = (yaml.load(m[1]) as Record<string, unknown>) || {}; } catch { /* keep header fields */ } }
  const head = (k: string) => r.content.match(new RegExp(`\\*\\*${k}:\\*\\*\\s*(.+)`))?.[1]?.trim() || "";
  const jd = r.content.match(/## Job Description[^\n]*\n+([^\n]{0,600})/)?.[1] || "";
  const loc = jd.match(/\b(Gurugram|Gurgaon|Noida|Delhi|New Delhi|Bengaluru|Bangalore|Mumbai|Pune|Hyderabad|Chennai|Dubai|Abu Dhabi|Sharjah|Remote|Singapore|London)\b/i)?.[1] || "";
  return {
    decision: String(y.final_decision || ""),
    archetype: String(y.archetype || head("Archetype")),
    legitimacy: String(y.legitimacy_tier || head("Legitimacy")),
    risk: String(y.risk_level || ""),
    strengths: list(y.top_strengths).slice(0, 3),
    gaps: list(y.soft_gaps).slice(0, 2),
    hardStops: list(y.hard_stops),
    location: loc,
  };
}
