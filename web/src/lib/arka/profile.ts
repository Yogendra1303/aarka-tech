// Aarka Tech career profile: one read model over the files that already hold it
// (cv.md, config/profile.yml, data/career-kb/*.json). Nothing is invented: a
// missing value is reported as missing.
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { getProfilePath } from "@/lib/core/profile-path.mjs";

const readJson = <T,>(p: string, d: T): T => { try { return JSON.parse(fs.readFileSync(p, "utf8")) as T; } catch { return d; } };

export type CheckItem = { id: string; label: string; done: boolean; detail: string; href?: string; state?: "present" | "missing" | "incomplete" | "outdated"; neededFor?: string; section?: string };
type Rec = Record<string, unknown>;

export function profilePath() { return getProfilePath(careerOpsRoot()); }

export function readProfile() {
  const root = careerOpsRoot();
  const kb = path.join(root, "data", "career-kb");
  let profile: Rec = {};
  try { profile = (yaml.load(fs.readFileSync(profilePath(), "utf8")) as Rec) || {}; } catch { /* missing */ }
  const cand = (profile.candidate || {}) as Rec;
  const comp = (profile.compensation || {}) as Rec;
  const loc = (profile.location || {}) as Rec;
  const cover = (profile.cover_letter || {}) as Rec;
  const targets = ((profile.target_roles || {}) as Rec).primary as string[] | undefined;
  const cv = (() => { try { return fs.readFileSync(path.join(root, "cv.md"), "utf8"); } catch { return ""; } })();
  const employment = readJson<Rec[]>(path.join(kb, "employment.json"), []);
  const engagements = readJson<Rec[]>(path.join(kb, "engagements.json"), []);
  const achievements = readJson<Rec[]>(path.join(kb, "achievements.json"), []);
  const skills = readJson<Rec[]>(path.join(kb, "skills.json"), []);
  const discrepancies = readJson<Rec[]>(path.join(kb, "discrepancies.json"), []);
  const sources = readJson<Rec[]>(path.join(kb, "sources.json"), []);
  const linkedinExport = sources.some((s) => s.kind === "linkedin-export" && s.path !== "pending");
  const openDis = discrepancies.filter((d) => !/^(resolved|info)/.test(String(d.status)));
  const s = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
  // 0 from a template is not an answer; only a value saved here (or a non-zero one) counts.
  const noticeSet = s(cover.notice_period_days) !== "" && (cover.notice_period_confirmed === true || Number(cover.notice_period_days) > 0);
  const salaryAmount = s(comp.target_range), salaryCur = s(comp.currency), salaryPer = s(comp.period);
  const salaryState: CheckItem["state"] = !salaryAmount ? "missing" : salaryCur && salaryPer ? "present" : "incomplete";

  const checks: CheckItem[] = [
    { id: "resume", label: "Resume on file", done: cv.length > 500, detail: cv ? "cv.md in use for every tailored resume" : "Upload a resume", href: "/cv" },
    { id: "contact", label: "Contact details", done: !!(s(cand.email) && s(cand.phone) && s(cand.location)), detail: [s(cand.email), s(cand.phone), s(cand.location)].filter(Boolean).join(" · ") || "Missing" },
    { id: "linkedin", label: "LinkedIn URL", done: !!s(cand.linkedin), detail: s(cand.linkedin) || "Not set" },
    { id: "targets", label: "Target roles", done: !!targets?.length, detail: targets?.join(", ") || "Not set" },
    { id: "locations", label: "Preferred locations", done: !!s(comp.location_flexibility), detail: s(comp.location_flexibility) || "Not set" },
    { id: "salary", label: "Salary expectation", done: salaryState === "present", state: salaryState, detail: salaryState === "present" ? `${salaryAmount} ${salaryCur} per ${salaryPer}` : salaryState === "incomplete" ? `"${salaryAmount}" saved without ${[!salaryCur && "currency", !salaryPer && "period"].filter(Boolean).join(" or ")}, so it can't be compared with job pay` : "Not set — evaluations cannot check pay fit" },
    { id: "notice", label: "Notice period", done: noticeSet, detail: noticeSet ? `${s(cover.notice_period_days)} days` : "Not set" },
    { id: "auth", label: "Work authorization (UAE)", done: !!s(loc.visa_status), detail: s(loc.visa_status) || "Not set — UAE applications ask this" },
    { id: "history", label: "Employment history", done: employment.length > 0, detail: `${employment.length} employers, ${employment.reduce((n, e) => n + ((e.positions as unknown[]) || []).length, 0)} positions (provisional until LinkedIn export)` },
    { id: "projects", label: "Consulting & client projects", done: engagements.length > 0, detail: `${engagements.length} engagements, all marked needs confirmation` },
    { id: "achievements", label: "Achievements with sources", done: achievements.length > 0, detail: `${achievements.length} achievements, ${skills.length} evidence-linked skills` },
    { id: "linkedin_export", label: "LinkedIn data export", done: linkedinExport, detail: linkedinExport ? "Imported" : "Optional — not received yet" },
    { id: "conflicts", label: "Conflicts resolved", done: openDis.length === 0, detail: `${openDis.length} open items to confirm` },
  ];
  // Education and skills as they appear in your resume and records (edited through the resume).
  const edu = (/##\s*Education\s+([\s\S]*?)(\n## |$)/.exec(cv) || [])[1]?.split("\n").filter((l) => /^\s*(-|\*\*|###)/.test(l)).length || 0;
  checks.push({ id: "education", label: "Education", done: edu > 0, detail: edu ? `${edu} entr${edu === 1 ? "y" : "ies"} in your resume` : "No Education section in your resume" });
  checks.push({ id: "skills", label: "Skills", done: skills.length > 0, detail: skills.length ? `${skills.length} skills, ${skills.filter((k) => ((k.evidence as unknown[]) || []).length).length} backed by an achievement` : "No skills recorded" });
  const cvAgeDays = (() => { try { return (Date.now() - fs.statSync(path.join(root, "cv.md")).mtimeMs) / 864e5; } catch { return 0; } })();
  const NEEDED: Record<string, string> = { resume: "every evaluation and tailored resume", contact: "resumes and cover letters", targets: "job matching", locations: "job matching", salary: "pay-fit checks in evaluations", notice: "application answers", auth: "UAE applications", history: "tailored resumes" };
  const SECTION: Record<string, string> = { resume: "Resume", contact: "Contact", linkedin: "LinkedIn URL", targets: "Target Roles", locations: "Locations", salary: "Salary", notice: "Notice Period", auth: "Work Authorization", history: "Employment", projects: "Consulting & Projects", achievements: "Achievements", skills: "Skills", education: "Education", linkedin_export: "Connected Accounts", conflicts: "Employment" };
  for (const c of checks) {
    c.state = c.state || (c.done ? "present" : "missing");
    if (c.id === "resume" && c.done && cvAgeDays > 180) { c.state = "outdated"; c.detail += ` · last updated ${Math.round(cvAgeDays)} days ago`; }
    if (c.id === "contact" && !c.done && [s(cand.email), s(cand.phone), s(cand.location)].some(Boolean)) c.state = "incomplete";
    if (c.id === "conflicts" && !c.done) c.state = "incomplete";
    c.neededFor = NEEDED[c.id]; c.section = SECTION[c.id];
  }
  const required = checks.filter((c) => !["linkedin_export", "education", "skills"].includes(c.id));
  return {
    name: s(cand.full_name),
    completion: Math.round((required.filter((c) => c.done).length / required.length) * 100),
    checks,
    preferences: {
      linkedin: s(cand.linkedin), target_range: s(comp.target_range), currency: s(comp.currency), minimum: s(comp.minimum),
      notice_period_days: noticeSet ? s(cover.notice_period_days) : "", visa_status: s(loc.visa_status),
      email: s(cand.email), phone: s(cand.phone), location: s(cand.location), salary_period: s(comp.period),
      locations: s(comp.location_flexibility), target_roles: (targets || []).join(", "),
      company_stages: s(((profile.targeting as Rec) || {}).company_stages), domains: s(((profile.targeting as Rec) || {}).domains),
    },
    openQuestions: openDis.slice(0, 12).map((d) => ({ id: d.id, issue: d.issue, question: d.question || null })),
  };
}

const FIELDS: Record<string, [string, string]> = {
  linkedin: ["candidate", "linkedin"], target_range: ["compensation", "target_range"], currency: ["compensation", "currency"],
  minimum: ["compensation", "minimum"], visa_status: ["location", "visa_status"], notice_period_days: ["cover_letter", "notice_period_days"],
  company_stages: ["targeting", "company_stages"], domains: ["targeting", "domains"],
  email: ["candidate", "email"], phone: ["candidate", "phone"], location: ["candidate", "location"],
  salary_period: ["compensation", "period"], locations: ["compensation", "location_flexibility"],
  target_roles: ["target_roles", "primary"],
};
const PERIODS = new Set(["year", "month", "hour"]);

// Updates only the named preference fields, after backing up profile.yml.
export function updatePreferences(input: Record<string, unknown>) {
  const file = profilePath();
  const raw = fs.readFileSync(file, "utf8");
  const doc = (yaml.load(raw) as Rec) || {};
  const changed: string[] = [];
  // A salary needs amount, currency and period together, so "18" can't be misread.
  const comp = (doc.compensation as Rec) || {};
  const amount = "target_range" in input ? String(input.target_range ?? "").trim() : String(comp.target_range ?? "");
  if (amount && ("target_range" in input || "currency" in input || "salary_period" in input)) {
    const cur = "currency" in input ? String(input.currency ?? "").trim() : String(comp.currency ?? "");
    const per = "salary_period" in input ? String(input.salary_period ?? "").trim() : String(comp.period ?? "");
    if (!cur || !per) throw new Error("Add the currency and whether the amount is per year, month or hour.");
  }
  for (const [k, [sec, key]] of Object.entries(FIELDS)) {
    if (!(k in input)) continue;
    let v = String(input[k] ?? "").trim().slice(0, 400);
    if (k === "notice_period_days") { if (v && !/^\d{1,3}$/.test(v)) throw new Error("Notice period must be a number of days."); }
    if (k === "linkedin" && v && !/linkedin\.com\/in\//i.test(v)) throw new Error("LinkedIn URL must look like linkedin.com/in/your-name.");
    if (k === "currency") { v = v.toUpperCase(); if (v && !/^[A-Z]{3}$/.test(v)) throw new Error("Currency must be a 3-letter code such as INR, AED or USD."); }
    if (k === "salary_period" && v && !PERIODS.has(v)) throw new Error("Salary period must be per year, month or hour.");
    if (k === "email" && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) throw new Error("That email address doesn't look right.");
    if (k === "phone" && v && !/^[+\d][\d ()-]{6,}$/.test(v)) throw new Error("Phone number should contain digits, spaces, + or -.");
    const section = ((doc[sec] as Rec) || (doc[sec] = {})) as Rec;
    const next = k === "notice_period_days" && v ? Number(v) : k === "target_roles" ? v.split(",").map((x) => x.trim()).filter(Boolean) : v;
    if (JSON.stringify(section[key]) !== JSON.stringify(next)) { section[key] = next; changed.push(k); }
    // A notice period counts as set only once you've entered it here (a template 0 doesn't).
    if (k === "notice_period_days") section.notice_period_confirmed = v !== "";
  }
  if (!changed.length) return { changed };
  const backupDir = path.join(careerOpsRoot(), "data", "setup");
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, `profile.yml.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`), raw);
  fs.writeFileSync(file, yaml.dump(doc, { lineWidth: 120, noRefs: true }));
  return { changed };
}
