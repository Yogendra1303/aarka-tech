import { test } from "node:test";
import assert from "node:assert/strict";
import { companyFromUrl, extractFacts, validateUrl } from "../../src/lib/arka/job-text.mjs";
import { wallReason } from "../../scripts/job-intake.mjs";

test("job links: public http(s) only, tracking removed", () => {
  assert.equal(validateUrl("not a url").ok, false);
  assert.equal(validateUrl("ftp://example.com/job").ok, false);
  for (const bad of ["http://localhost:3000/x", "http://127.0.0.1/x", "http://192.168.1.4/job", "http://10.0.0.2/a", "https://user:pw@example.com/job", "http://intranet/job"]) assert.equal(validateUrl(bad).ok, false, bad);
  const ok = validateUrl("https://jobs.lever.co/acme/123?utm_source=x&lever-origin=applied#top");
  assert.equal(ok.ok, true);
  assert.equal(ok.url, "https://jobs.lever.co/acme/123?lever-origin=applied");
});

test("employer from the board link", () => {
  assert.equal(companyFromUrl("https://jobs.smartrecruiters.com/northwind/600-operations-manager"), "Northwind");
  assert.equal(companyFromUrl("https://boards.greenhouse.io/north-wind/jobs/1"), "North Wind");
  assert.equal(companyFromUrl("https://acme.wd5.myworkdayjobs.com/en-US/careers/job/x"), "Acme");
  assert.equal(companyFromUrl("https://careers.contoso.com/jobs/7"), "Contoso");
});

test("stated facts only: location, type, salary, requirements", () => {
  const t = "Location: Lisbon, Portugal\nFull-time role\nSalary: €60,000 - €70,000 per year\n\nRequirements\n- 6+ years running multi-site operations\nSkills:\n2) Fluent English\n\nBenefits\n- Health cover";
  const f = extractFacts(t);
  assert.equal(f.location, "Lisbon, Portugal");
  assert.equal(f.employmentType, "Full-time");
  assert.match(f.salary, /€60,000/);
  assert.deepEqual(f.requirements, ["6+ years running multi-site operations", "Fluent English"]);
  const none = extractFacts("We are hiring. Join our team to build things.");
  assert.equal(none.salary, ""); assert.equal(none.location, ""); assert.deepEqual(none.requirements, []);
});

test("sign-in walls and CAPTCHAs ask for a paste instead of a retry", () => {
  assert.match(wallReason("Please sign in to view this job and continue"), /paste/i);
  assert.match(wallReason("Verify you are human by completing the action below. ".repeat(10)), /paste/i);
  assert.match(wallReason("short"), /paste/i);
  assert.equal(wallReason("A real job description with responsibilities and requirements. ".repeat(10)), "");
});
