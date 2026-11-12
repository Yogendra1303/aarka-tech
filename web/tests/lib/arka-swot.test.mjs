import { test } from "node:test";
import assert from "node:assert/strict";
const { computeSwot } = await import("../../src/lib/arka/swot.ts");

const model = (over) => ({ state: "complete", problems: [], score: 3.5, scoreText: "3.5/5", decision: "Consider", legitimacy: "", confidence: "", confidenceWhy: "", url: "", date: "2026-10-20", archetype: "Ops Lead", location: "", verification: "", risk: "", verdictLine: "", strengths: [], softGaps: [], hardStops: [], openQuestions: [], nextAction: "", requirements: [], gaps: [], emphasise: [], verifyFirst: [], scoreEvidence: {}, ...over });
const base = { employment: [{ id: "EMP-A", employer: "Acme", positions: [{ id: "POS-A", title: "GM" }] }], projects: [], discrepancies: [], kbDir: "/nonexistent", cvPath: "/nonexistent/cv.md" };

test("threats need the same constraint in two postings; one-off gaps stay job-specific", () => {
  const one = computeSwot({ ...base, achievements: [], skills: [], reports: [
    { company: "A", role: "R1", n: "1", date: "2026-10-20", model: model({ softGaps: ["Postgraduate degree listed; cv shows a bachelor's"] }) },
    { company: "B", role: "R2", n: "2", date: "2026-10-21", model: model({ softGaps: ["Travel industry experience preferred"] }) },
  ] });
  assert.equal(one.threats.length, 0);
  assert.equal(one.jobSpecific.length, 2);
  const two = computeSwot({ ...base, achievements: [], skills: [], reports: [
    { company: "A", role: "R1", n: "1", date: "2026-10-20", model: model({ softGaps: ["Postgraduate degree listed"] }) },
    { company: "B", role: "R2", n: "2", date: "2026-10-21", model: model({ softGaps: ["MBA preferred"] }) },
  ] });
  assert.equal(two.threats.length, 1);
  assert.match(two.threats[0].evidence, /2 of 2 evaluated postings \(2026-10-20 to 2026-10-21\)/);
});

test("weaknesses are evidence gaps, strengths cite achievements, opportunities are marked as inferences", () => {
  const w = computeSwot({ ...base, reports: [],
    achievements: [{ id: "A1", owner: "POS-A", text: "Grew revenue 20%", metric: "+20%", confidence: "consistent across resumes" }, { id: "A2", owner: "POS-A", text: "Led ops team" }],
    skills: [{ id: "S1", name: "Operations", category: "skill", evidence: ["A1", "A2"] }, { id: "S2", name: "Airtable", category: "tool", evidence: [] }] });
  assert.equal(w.strengths[0].text, "Operations");
  assert.match(w.strengths.find((x) => x.text === "Grew revenue 20%").evidence, /GM at Acme/);
  assert.ok(w.weaknesses.some((x) => /1 of 2 achievements have no measurable result/.test(x.text)));
  assert.ok(w.weaknesses.some((x) => /Airtable/.test(x.text)));
  assert.ok(w.opportunities.every((x) => x.inference));
});
