import { pipelineSummary } from "@/lib/career-ops";
import { pendingInbox } from "@/lib/inbox-pending.mjs";
import { canonStatus, scoreNum } from "@/lib/format";
import { evaluationFor } from "@/lib/arka/evaluations";
import { readPrefs } from "@/lib/arka/favourites";
import { companyName } from "@/lib/arka/normalize.mjs";

// Dashboard numbers, all counted from the tracker, new-postings file and Explore preferences.
const SHORTLIST_MIN = 4;
export function readOverview() {
  const { inbox, applications } = pipelineSummary();
  const pending = pendingInbox(inbox);
  const st = (s: string) => canonStatus(s).toUpperCase();
  const evaluated = applications.filter((a) => st(a.status) === "EVALUATED");
  const shortlisted = evaluated.filter((a) => scoreNum(a.score) >= SHORTLIST_MIN);
  const inProgress = applications.filter((a) => ["APPLIED", "RESPONDED", "ASSESSMENT"].includes(st(a.status)));
  const interviews = applications.filter((a) => ["INTERVIEW", "RESPONDED"].includes(st(a.status)));
  const today = Date.now();
  const stale = applications.filter((a) => st(a.status) === "APPLIED" && a.date && (today - new Date(a.date).getTime()) / 864e5 >= 14);
  // Opportunities still open to act on: evaluated, not applied, not closed, and not a Skip verdict.
  const strongest = applications
    .filter((a) => st(a.status) === "EVALUATED" && !Number.isNaN(scoreNum(a.score)))
    .filter((a) => !/skip/i.test(evaluationFor(a.n)?.decision || ""))
    .sort((x, y) => scoreNum(y.score) - scoreNum(x.score)).slice(0, 4)
    .map((a) => { const ev = evaluationFor(a.n); return { n: a.n, company: companyName(a.company), role: a.role, score: a.score, status: canonStatus(a.status), verdict: ev?.decision || "", strength: ev?.strengths[0] || "" }; });
  const prefs = readPrefs();
  const alertNames = new Set(prefs.favourites.filter((f) => f.alerts).map((f) => f.name.toLowerCase()));
  // One item per company + title, even when a posting is listed for several cities.
  const seenRole = new Set<string>();
  const tracked = new Set(applications.map((a) => `${companyName(a.company)}|${a.role}`.toLowerCase()));
  const favouriteRoles = pending.filter((j) => alertNames.has(companyName(j.company).toLowerCase()) && !tracked.has(`${companyName(j.company)}|${j.role}`.toLowerCase()))
    .filter((j) => { const k = `${companyName(j.company)}|${j.role}`.toLowerCase(); return seenRole.has(k) ? false : (seenRole.add(k), true); })
    .slice(0, 3).map((j) => ({ company: companyName(j.company), role: j.role, url: j.url }));
  return {
    awaitingEvaluation: pending.length,
    shortlisted: shortlisted.length,
    toDecide: evaluated.length,
    inProgress: inProgress.length,
    interviews: interviews.length,
    staleApplied: stale.map((a) => ({ n: a.n, company: companyName(a.company), role: a.role, date: a.date })),
    strongest,
    favourites: prefs.favourites.length,
    favouriteRoles,
  };
}
