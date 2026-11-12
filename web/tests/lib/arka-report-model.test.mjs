import { test } from "node:test";
import assert from "node:assert/strict";
const { parseReportModel } = await import("../../src/lib/arka/report-model.ts");

const REPORT = `# Evaluation: Acme — Operations Manager

**Date:** 2026-10-21
**URL:** https://jobs.example.com/acme/1
**Score:** 3.4/5
**Decision:** Skip
**Legitimacy:** High Confidence

## Machine Summary

\`\`\`yaml
company: "Acme"
score: 3.4
final_decision: "Skip"
hard_stops: []
soft_gaps:
  - "Postgraduate degree listed"
top_strengths:
  - "Led a 50+ member team"
confidence: "Medium"
next_action: "Do not apply"
posting_location: "Pune, India"
\`\`\`

## B) Match with CV

| Requirement | Importance | Match | JD signal | Evidence / gap |
|---|---|---|---|---|
| Own hub operations | critical (stated) | ✅ Strong | "Operations Manager" | "Led a 50+ member operations team" |
| Work from Pune | critical (stated) | ⚠️ Partial | office base | Prefers NCR |
| Postgraduate degree | high (structural) | ❌ Missing | Qualifications | No postgraduate degree in cv.md |

### Gaps

1. **Postgraduate degree (high, ❌ Missing)**
   - *Blocker?* Possibly. Often screened on.
   - *Mitigation:* Ask the recruiter early.

## Score Evidence

**Evidence confidence:** Medium — compensation unknown.

**Verification priorities:**
1. Confirm the degree filter.
`;

test("reads decision, coverage groups and gaps from a complete report", () => {
  const m = parseReportModel(REPORT);
  assert.equal(m.state, "complete");
  assert.equal(m.score, 3.4); assert.equal(m.decision, "Skip"); assert.equal(m.location, "Pune, India");
  assert.deepEqual(m.requirements.map((r) => r.match), ["strong", "partial", "blocker"]);
  assert.equal(m.gaps[0].mitigation, "Ask the recruiter early.");
  assert.deepEqual(m.verifyFirst, ["Confirm the degree filter."]);
  assert.equal(m.confidence, "Medium");
});

test("a report without score or summary is failed, never a verdict", () => {
  const m = parseReportModel("# Evaluation: X\n\nThe agent stopped before finishing.");
  assert.equal(m.state, "failed");
  assert.ok(m.problems.length >= 2);
});
