// Aarka Tech career profile: one read model over the files that already hold it
// (cv.md, config/profile.yml, data/career-kb/*.json). Nothing is invented: a
// missing value is reported as missing.
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { getProfilePath } from "@/lib/core/profile-path.mjs";

const readJson = <T,>(p: string, d: T): T => { try { return JSON.parse(fs.readFileSync(p, "utf8")) as T; } catch { return d; } };

export type CheckItem = { id: string; label: string; done: boolean; detail: string; href?: string };
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

  const checks: CheckItem[] = [
    { id: "resume", label: "Resume on file", done: cv.length > 500, detail: cv ? "cv.md in use for every tailored resume" : "Upload a resume", href: "/cv" },
    { id: "contact", label: "Contact details", done: !!(s(cand.email) && s(cand.phone) && s(cand.location)), detail: [s(cand.email), s(cand.phone), s(cand.location)].filter(Boolean).join(" · ") || "Missing" },
    { id: "linkedin", label: "LinkedIn URL", done: !!s(cand.linkedin), detail: s(cand.linkedin) || "Not set" },
    { id: "targets", label: "Target roles", done: !!targets?.length, detail: targets?.join(", ") || "Not set" },
    { id: "locations", label: "Preferred locations", done: !!s(comp.location_flexibility), detail: s(comp.location_flexibility) || "Not set" },
    { id: "salary", label: "Salary expectation", done: !!s(comp.target_range), detail: s(comp.target_range) ? `${s(comp.target_range)} ${s(comp.currency)}`.trim() : "Not set — evaluations cannot check pay fit" },
    { id: "notice", label: "Notice period", done: cover.notice_period_days !== undefined && cover.notice_period_days !== null && s(cover.notice_period_days) !== "", detail: s(cover.notice_period_days) ? `${s(cover.notice_period_days)} days` : "Not set" },
    { id: "auth", label: "Work authorization (UAE)", done: !!s(loc.visa_status), detail: s(loc.visa_status) || "Not set — UAE applications ask this" },
    { id: "history", label: "Employment history", done: employment.length > 0, detail: `${employment.length} employers, ${employment.reduce((n, e) => n + ((e.positions as unknown[]) || []).length, 0)} positions (provisional until LinkedIn export)` },
    { id: "projects", label: "Consulting & client projects", done: engagements.length > 0, detail: `${engagements.length} engagements, all marked needs confirmation` },
    { id: "achievements", label: "Achievements with sources", done: achievements.length > 0, detail: `${achievements.length} achievements, ${skills.length} evidence-linked skills` },
    { id: "linkedin_export", label: "LinkedIn data export", done: linkedinExport, detail: linkedinExport ? "Imported" : "Optional — not received yet" },
    { id: "conflicts", label: "Conflicts resolved", done: openDis.length === 0, detail: `${openDis.length} open items to confirm` },
  ];
  const required = checks.filter((c) => c.id !== "linkedin_export");
  return {
    name: s(cand.full_name),
    completion: Math.round((required.filter((c) => c.done).length / required.length) * 100),
    checks,
    preferences: {
      linkedin: s(cand.linkedin), target_range: s(comp.target_range), currency: s(comp.currency), minimum: s(comp.minimum),
      notice_period_days: s(cover.notice_period_days), visa_status: s(loc.visa_status),
      company_stages: s(((profile.targeting as Rec) || {}).company_stages), domains: s(((profile.targeting as Rec) || {}).domains),
    },
    openQuestions: openDis.slice(0, 12).map((d) => ({ id: d.id, issue: d.issue, question: d.question || null })),
  };
}

const FIELDS: Record<string, [string, string]> = {
  linkedin: ["candidate", "linkedin"], target_range: ["compensation", "target_range"], currency: ["compensation", "currency"],
  minimum: ["compensation", "minimum"], visa_status: ["location", "visa_status"], notice_period_days: ["cover_letter", "notice_period_days"],
  company_stages: ["targeting", "company_stages"], domains: ["targeting", "domains"],
};

// Updates only the named preference fields, after backing up profile.yml.
export function updatePreferences(input: Record<string, unknown>) {
  const file = profilePath();
  const raw = fs.readFileSync(file, "utf8");
  const doc = (yaml.load(raw) as Rec) || {};
  const changed: string[] = [];
  for (const [k, [sec, key]] of Object.entries(FIELDS)) {
    if (!(k in input)) continue;
    let v = String(input[k] ?? "").trim().slice(0, 400);
    if (k === "notice_period_days") { if (v && !/^\d{1,3}$/.test(v)) throw new Error("Notice period must be a number of days."); }
    if (k === "linkedin" && v && !/linkedin\.com\/in\//i.test(v)) throw new Error("LinkedIn URL must look like linkedin.com/in/your-name.");
    if (k === "currency") v = v.toUpperCase();
    const section = ((doc[sec] as Rec) || (doc[sec] = {})) as Rec;
    const next = k === "notice_period_days" && v ? Number(v) : v;
    if (section[key] !== next) { section[key] = next; changed.push(k); }
  }
  if (!changed.length) return { changed };
  const backupDir = path.join(careerOpsRoot(), "data", "setup");
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, `profile.yml.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`), raw);
  fs.writeFileSync(file, yaml.dump(doc, { lineWidth: 120, noRefs: true }));
  return { changed };
}
