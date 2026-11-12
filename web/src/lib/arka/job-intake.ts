import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { careerOpsRoot, readApplications, readInbox } from "@/lib/career-ops";
import { addOffersToPipeline } from "@/lib/core/pipeline";
import { rootScript } from "@/lib/career-ops";
import { findTracked, urlKey } from "@/lib/arka/applied";
import { companyName } from "@/lib/arka/normalize.mjs";
import { companyFromUrl, extractFacts, validateUrl } from "@/lib/arka/job-text.mjs";

// "Add a Job": a job link or a pasted description becomes a saved job with its provenance.
// Fields are only filled when the posting states them; everything is editable before saving.

export type JobDraft = {
  url: string; company: string; title: string; location: string; employmentType: string; salary: string;
  requirements: string[]; description: string; source: "manual_url" | "user_pasted_description";
  fetchedVia: string; fetchedAt: string | null;
};
export type SavedJob = JobDraft & { id: string; savedAt: string; jdFile: string; edited: string[]; inInbox: boolean };
export type Duplicate = { where: "applications" | "new postings" | "added jobs"; label: string; n?: string; id?: string };

const registry = () => path.join(careerOpsRoot(), "data", "arka-manual-jobs.json");
export function readSaved(): SavedJob[] { try { return JSON.parse(fs.readFileSync(registry(), "utf8")); } catch { return []; } }
function writeSaved(list: SavedJob[]) { const f = registry(); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(`${f}.tmp`, JSON.stringify(list, null, 2)); fs.renameSync(`${f}.tmp`, f); }

function runIntake(url: string): Promise<Record<string, unknown>> {
  const script = path.join(path.dirname(rootScript("browser-extract")), "web", "scripts", "job-intake.mjs");
  return new Promise((resolve) => execFile(process.execPath, [script, "fetch", url], { timeout: 60_000, maxBuffer: 4 * 1024 * 1024, cwd: careerOpsRoot() },
    (err, stdout) => { try { resolve(JSON.parse(stdout)); } catch { resolve({ ok: false, needsPaste: true, reason: "The page could not be read in time. Paste the job description instead.", detail: err?.message }); } }));
}

export function findDuplicates(d: { url?: string; company?: string; title?: string }): Duplicate[] {
  const out: Duplicate[] = [];
  const tracked = findTracked({ url: d.url, company: d.company, role: d.title });
  if (tracked) out.push({ where: "applications", label: `${tracked.company} · ${tracked.role} (${tracked.status})`, n: String(tracked.n) });
  const k = d.url ? urlKey(d.url) : "";
  const inbox = k ? readInbox().find((j) => urlKey(j.url) === k) : undefined;
  if (inbox && !tracked) out.push({ where: "new postings", label: `${inbox.company} · ${inbox.role}` });
  const saved = readSaved().find((s) => (k && s.url && urlKey(s.url) === k) || (d.company && d.title && companyName(s.company).toLowerCase() === companyName(d.company).toLowerCase() && s.title.toLowerCase() === d.title.toLowerCase()));
  if (saved) out.push({ where: "added jobs", label: `${saved.company} · ${saved.title}`, id: saved.id });
  return out;
}

export async function analyzeUrl(raw: string): Promise<{ draft?: JobDraft; duplicates: Duplicate[]; needsPaste?: boolean; reason?: string; error?: string }> {
  const v = validateUrl(raw);
  if (!v.ok) return { error: v.error, duplicates: [] };
  const cached = readSaved().find((s) => s.url && urlKey(s.url) === urlKey(v.url));
  if (cached) return { draft: cached, duplicates: findDuplicates(cached) };
  const r = await runIntake(v.url);
  if (!r.ok) return { needsPaste: true, reason: String(r.reason || "Paste the job description instead."), duplicates: findDuplicates({ url: v.url }) };
  const text = String(r.text || "");
  const facts = extractFacts(text);
  const draft: JobDraft = {
    url: v.url, company: companyFromUrl(String(r.finalUrl || v.url)), title: String(r.title || "").replace(/\s+[|–-]\s+.*$/, "").trim(),
    ...facts, description: text, source: "manual_url", fetchedVia: String(r.via || ""), fetchedAt: new Date().toISOString(),
  };
  return { draft, duplicates: findDuplicates(draft) };
}

export function draftFromText(input: { text: string; url?: string; company?: string; title?: string; location?: string }): { draft?: JobDraft; duplicates: Duplicate[]; error?: string } {
  const text = String(input.text || "").replace(/\r/g, "").trim().slice(0, 30000);
  if (text.length < 200) return { error: "That's too short to be a job description. Paste the full text.", duplicates: [] };
  let url = "";
  if (input.url?.trim()) { const v = validateUrl(input.url); if (!v.ok) return { error: v.error, duplicates: [] }; url = v.url; }
  const facts = extractFacts(text);
  const firstLine = text.split("\n").find((l) => l.trim().length > 3)?.trim().slice(0, 140) || "";
  const draft: JobDraft = {
    url, company: input.company?.trim() || (url ? companyFromUrl(url) : ""), title: input.title?.trim() || (firstLine.length < 90 ? firstLine : ""),
    ...facts, location: input.location?.trim() || facts.location, description: text, source: "user_pasted_description", fetchedVia: "pasted", fetchedAt: null,
  };
  return { draft, duplicates: findDuplicates(draft) };
}

const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\r\t]+/g, " ").trim().slice(0, n);
export async function saveJob(d: JobDraft & { edited?: string[] }): Promise<SavedJob> {
  const company = clean(d.company, 120), titleText = clean(d.title, 200);
  if (!company || !titleText) throw new Error("Employer and job title are required.");
  if (!d.description || d.description.length < 200) throw new Error("A job description is required.");
  if (d.url) { const v = validateUrl(d.url); if (!v.ok) throw new Error(v.error); }
  const list = readSaved();
  const dupe = list.find((s) => (d.url && s.url && urlKey(s.url) === urlKey(d.url)) || (companyName(s.company).toLowerCase() === companyName(company).toLowerCase() && s.title.toLowerCase() === titleText.toLowerCase()));
  if (dupe) return dupe;
  const id = crypto.randomBytes(6).toString("hex");
  const slug = `${company}-${titleText}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const jdRel = `data/jds/manual-${slug}-${id}.md`;
  const provenance = [`# ${company} — ${titleText}`, "", `- Source: ${d.source === "manual_url" ? "job link added by you" : "description pasted by you"}`, d.url ? `- URL: ${d.url}` : "", d.fetchedAt ? `- Fetched: ${d.fetchedAt} via ${d.fetchedVia}` : "", `- Saved: ${new Date().toISOString()}`, d.edited?.length ? `- Edited before saving: ${d.edited.join(", ")}` : "", "", "## Job Description (as captured)", "", d.description].filter((l) => l !== "").join("\n");
  fs.mkdirSync(path.join(careerOpsRoot(), "data", "jds"), { recursive: true });
  fs.writeFileSync(path.join(careerOpsRoot(), jdRel), provenance + "\n");
  let inInbox = false;
  if (d.url && !findTracked({ url: d.url })) {
    const r = await addOffersToPipeline([{ url: d.url, company, title: titleText, location: clean(d.location, 120), postedAt: "", ats: d.fetchedVia.replace(/^ats-api:/, "") || "manual", source: "manual", note: `added manually (${d.source})` }]);
    inInbox = (r as { added?: number }).added ? true : readInbox().some((j) => urlKey(j.url) === urlKey(d.url));
  }
  const saved: SavedJob = { ...d, company, title: titleText, location: clean(d.location, 120), employmentType: clean(d.employmentType, 40), salary: clean(d.salary, 80),
    requirements: (d.requirements || []).map((r) => clean(r, 300)).filter(Boolean).slice(0, 30), id, savedAt: new Date().toISOString(), jdFile: jdRel, edited: d.edited || [], inInbox };
  writeSaved([saved, ...list]);
  return saved;
}

export function removeSaved(id: string) { writeSaved(readSaved().filter((s) => s.id !== id)); }
export function trackedFor(job: SavedJob) { const t = findTracked({ url: job.url, company: job.company, role: job.title }, readApplications()); return t ? { n: String(t.n), status: t.status, score: t.score } : null; }
