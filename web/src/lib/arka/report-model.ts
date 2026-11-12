import * as yaml from "js-yaml";

// A structured reading of one evaluation report, for the decision-first report page.
// Everything comes from the report itself (header fields, the Machine Summary block and the
// "Match with CV" table). Missing pieces stay missing; nothing is inferred or invented.

export type Coverage = "strong" | "partial" | "missing" | "blocker";
export type Requirement = { requirement: string; importance: string; match: Coverage; jdSignal: string; evidence: string };
export type Gap = { title: string; blocker: string; mitigation: string };
export type ReportModel = {
  state: "complete" | "partial" | "failed";
  problems: string[];
  score: number | null; scoreText: string; decision: string; legitimacy: string; confidence: string; confidenceWhy: string;
  url: string; date: string; archetype: string; location: string; verification: string; risk: string;
  verdictLine: string; strengths: string[]; softGaps: string[]; hardStops: string[]; openQuestions: string[];
  nextAction: string; requirements: Requirement[]; gaps: Gap[]; emphasise: string[]; verifyFirst: string[];
  scoreEvidence: Record<string, string>;
};

const strip = (s: string) => s.replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim();
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => strip(String(x))).filter(Boolean) : []);

function section(md: string, heading: RegExp): string {
  const lines = md.split("\n");
  const i = lines.findIndex((l) => /^#{2,3}\s/.test(l) && heading.test(l));
  if (i < 0) return "";
  const level = (lines[i].match(/^#+/) || ["##"])[0].length;
  const out: string[] = [];
  for (const l of lines.slice(i + 1)) { const m = l.match(/^(#+)\s/); if (m && m[1].length <= level) break; out.push(l); }
  return out.join("\n");
}

function tableRows(md: string): string[][] {
  return md.split("\n").filter((l) => /^\s*\|/.test(l) && !/^\s*\|\s*:?-{2,}/.test(l))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
}

function coverageOf(cell: string): Coverage {
  const c = cell.toLowerCase();
  if (/blocker|hard stop|❌.*block/.test(c)) return "blocker";
  if (/❌|missing|none|absent|no evidence/.test(c)) return "missing";
  if (/⚠|partial|adjacent|some/.test(c)) return "partial";
  return "strong";
}

export function parseReportModel(md: string): ReportModel {
  const head = (k: string) => strip(md.match(new RegExp(`^\\*\\*${k}:\\*\\*\\s*(.+)$`, "m"))?.[1] || "");
  const problems: string[] = [];
  let y: Record<string, unknown> = {};
  const m = md.match(/## Machine Summary[\s\S]*?```ya?ml\n([\s\S]*?)```/);
  if (m) { try { y = (yaml.load(m[1]) as Record<string, unknown>) || {}; } catch { problems.push("The structured summary could not be read."); } }
  else problems.push("The report has no structured summary.");

  const scoreText = head("Score") || (y.score != null ? `${y.score}/5` : "");
  const sNum = parseFloat(scoreText);
  const score = Number.isFinite(sNum) ? sNum : null;
  if (score == null) problems.push("No score was recorded.");
  const decision = strip(String(y.final_decision || head("Decision") || ""));
  if (!decision) problems.push("No decision was recorded.");

  // Requirement coverage: the "Match with CV" table, else the structured list.
  let requirements: Requirement[] = [];
  const rows = tableRows(section(md, /^##\s*B\)|Match with CV|CV Match/i));
  if (rows.length > 1) {
    const hdr = rows[0].map((h) => h.toLowerCase());
    const col = (re: RegExp) => hdr.findIndex((h) => re.test(h));
    const [ri, ii, mi, ji, ei] = [col(/requirement/), col(/importance/), col(/match/), col(/signal/), col(/evidence|gap/)];
    requirements = rows.slice(1).filter((r) => r[ri]).map((r) => ({
      requirement: strip(r[ri] || ""), importance: strip(r[ii] || "").replace(/\s*\(.*\)$/, ""), match: coverageOf(r[mi] || ""),
      jdSignal: strip(r[ji] || ""), evidence: strip(r[ei] || ""),
    }));
  } else if (Array.isArray(y.requirement_importance)) {
    requirements = (y.requirement_importance as Record<string, unknown>[]).map((r) => ({
      requirement: strip(String(r.requirement || "")), importance: strip(String(r.importance || "")), match: coverageOf(String(r.match || "")),
      jdSignal: strip(String(r.jd_signal || "")), evidence: "",
    }));
  }

  // Gaps with the report's own blocker judgement and mitigation.
  const gaps: Gap[] = [];
  const gapMd = section(md, /^###\s*Gaps/i) || section(md, /Gaps/i);
  for (const block of gapMd.split(/\n(?=\d+\.\s)/)) {
    const t = block.match(/^\d+\.\s+\*\*(.+?)\*\*/);
    if (!t) continue;
    const pick = (label: RegExp) => strip(block.match(new RegExp(`\\*${label.source}[^*\\n]*\\*\\s*(.+)`, "i"))?.[1] || "");
    gaps.push({ title: strip(t[1]), blocker: pick(/Blocker/), mitigation: pick(/Mitigation/) });
  }
  // A missing critical requirement, or one the report calls a possible blocker, is a potential blocker.
  for (const r of requirements) {
    const g = gaps.find((x) => x.title.toLowerCase().includes(r.requirement.toLowerCase().slice(0, 18)));
    if (r.match === "missing" && (/critical/i.test(r.importance) || /^(yes|possibly)/i.test(g?.blocker || ""))) r.match = "blocker";
  }

  const emphasise = tableRows(section(md, /Customization Plan/i)).slice(1)
    .map((r) => strip(r[3] || "")).filter((x) => x && !/^proposed/i.test(x)).slice(0, 3);
  const verifyFirst = (section(md, /Score Evidence/i).split(/\*\*Verification priorities:\*\*/)[1] || "")
    .split("\n").map((l) => l.match(/^\s*\d+\.\s+(.+)/)?.[1]).filter(Boolean).map((x) => strip(x!)).slice(0, 4);
  const confLine = strip(section(md, /Score Evidence/i).match(/\*\*Evidence confidence:\*\*\s*(.+)/)?.[1] || "");
  const verdictSection = strip(section(md, /^##\s*Verdict/i) || md.match(/^\*\*(Skip|Apply|Consider)[^\n]*\n?/m)?.[0] || "");

  if (!requirements.length) problems.push("The requirement-by-requirement match is missing.");
  const state: ReportModel["state"] = score == null || !decision ? "failed" : problems.length ? "partial" : "complete";
  return {
    state, problems,
    score, scoreText, decision, legitimacy: strip(String(y.legitimacy_tier || head("Legitimacy"))),
    confidence: strip(String(y.confidence || confLine.split(/\s+[—-]\s+/)[0] || "")), confidenceWhy: confLine.split(/\s+[—-]\s+/).slice(1).join(" — "),
    url: head("URL"), date: head("Date"), archetype: head("Archetype"), location: strip(String(y.posting_location || "")),
    verification: head("Verification"), risk: strip(String(y.risk_level || "")),
    verdictLine: verdictSection.replace(/^(Skip|Apply|Consider)\.\s*/i, ""),
    strengths: list(y.top_strengths), softGaps: list(y.soft_gaps), hardStops: list(y.hard_stops), openQuestions: list(y.confidence_gaps),
    nextAction: strip(String(y.next_action || "")), requirements, gaps, emphasise, verifyFirst,
    scoreEvidence: (y.score_evidence && typeof y.score_evidence === "object" ? Object.fromEntries(Object.entries(y.score_evidence as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : {}),
  };
}
