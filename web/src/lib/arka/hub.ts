// Aarka Tech Career Hub: one read/write model over the user's existing files.
// - Facts: cv.md, config/profile.yml, data/career-kb/*.json (built from sources)
// - User edits made in the Hub: data/career-kb/user-records.json (overlay; KB rebuilds never touch it)
// - Document library labels/archive flags: data/career-kb/library.json
// Insights are computed deterministically from these records; nothing is invented.
import fs from "node:fs";
import { getProfilePath } from "@/lib/core/profile-path.mjs";
import { parseReportModel } from "@/lib/arka/report-model";
import { computeSwot } from "@/lib/arka/swot";
import path from "node:path";
import crypto from "node:crypto";
import * as yaml from "js-yaml";
import { careerOpsRoot, readApplications } from "@/lib/career-ops";
import { readProfile } from "@/lib/arka/profile";

type Rec = Record<string, unknown>;
const root = () => careerOpsRoot();
const kbDir = () => path.join(root(), "data", "career-kb");
const readJson = <T,>(p: string, d: T): T => { try { return JSON.parse(fs.readFileSync(p, "utf8")) as T; } catch { return d; } };
const writeJson = (p: string, v: unknown) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };
const USER = () => path.join(kbDir(), "user-records.json");
const LIB = () => path.join(kbDir(), "library.json");

// ---------- experience: union of non-overlapping months (overlaps counted once)
const ym = (v: unknown): number | null => { const m = /^(\d{4})-(\d{2})/.exec(String(v || "")); return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null; };
export function experienceMonths(periods: { start: number; end: number }[]) {
  const sorted = periods.filter((p) => p.end >= p.start).sort((a, b) => a.start - b.start);
  let total = 0; let cur: { start: number; end: number } | null = null;
  for (const p of sorted) {
    if (!cur) { cur = { ...p }; continue; }
    if (p.start <= cur.end + 1) cur.end = Math.max(cur.end, p.end);
    else { total += cur.end - cur.start + 1; cur = { ...p }; }
  }
  if (cur) total += cur.end - cur.start + 1;
  return total;
}

function userRecords() { return readJson<{ projects: Rec[]; headline?: string; summary?: string }>(USER(), { projects: [] }); }

export function readHub() {
  const kb = kbDir();
  const employment = readJson<Rec[]>(path.join(kb, "employment.json"), []);
  const consulting = readJson<Rec[]>(path.join(kb, "consulting.json"), []);
  const kbProjects = readJson<Rec[]>(path.join(kb, "engagements.json"), []);
  const initiatives = readJson<Rec[]>(path.join(kb, "initiatives.json"), []);
  const achievements = readJson<Rec[]>(path.join(kb, "achievements.json"), []);
  const skills = readJson<Rec[]>(path.join(kb, "skills.json"), []);
  const user = userRecords();
  const profile = readProfile();
  let prof: Rec = {};
  try { prof = (yaml.load(fs.readFileSync(getProfilePath(root()), "utf8")) as Rec) || {}; } catch {}
  const narrative = (prof.narrative || {}) as Rec;
  const targets = (((prof.target_roles || {}) as Rec).primary as string[]) || [];
  const locations = String(((prof.compensation || {}) as Rec).location_flexibility || "");
  const cv = (() => { try { return fs.readFileSync(path.join(root(), "cv.md"), "utf8"); } catch { return ""; } })();
  const cvSummary = (/## Professional Summary\s+([\s\S]*?)\n## /.exec(cv) || [])[1]?.trim() || "";

  // Experience from dated records; "Present" counts to today. Dates are resume-stated (provisional).
  const now = new Date(); const nowYm = now.getFullYear() * 12 + now.getMonth();
  const periods: { start: number; end: number }[] = [];
  for (const e of employment) for (const pos of (e.positions as Rec[]) || []) {
    const s = ym((pos.start as Rec)?.value ?? (e.start as Rec)?.value); const en = ym((pos.end as Rec)?.value ?? (e.end as Rec)?.value);
    if (s !== null) periods.push({ start: s, end: en ?? nowYm });
  }
  for (const c of consulting) { const s = ym((c.start as Rec)?.value); if (s !== null) periods.push({ start: s, end: ym((c.end as Rec)?.value) ?? nowYm }); }
  const months = experienceMonths(periods);
  const current = consulting.find((c) => !(c.end as Rec)?.value) ? `${String(consulting[0].role || "Independent consultant")} (since ${String((consulting[0].start as Rec)?.value)})` : null;

  // Projects = KB engagements + Hub-created/edited records (Hub edits win by id).
  const userById = new Map(user.projects.map((p) => [String(p.id), p]));
  const projects = [
    ...kbProjects.map((p) => ({ ...p, origin: "career database", ...(userById.get(String(p.id)) || {}) })),
    ...user.projects.filter((p) => !kbProjects.some((k) => k.id === p.id)).map((p) => ({ ...p, origin: "added in Career Hub" })),
  ];

  // ---------- insights (deterministic, each with its derivation)
  const achById = new Map(achievements.map((a) => [String(a.id), a]));
  const strengths = skills
    .map((s) => ({ name: String(s.name), evidence: ((s.evidence as string[]) || []).filter((id) => achById.has(id)) }))
    .filter((s) => s.evidence.length >= 2).sort((a, b) => b.evidence.length - a.evidence.length).slice(0, 6)
    .map((s) => ({ name: s.name, how: `${s.evidence.length} sourced achievements`, examples: s.evidence.slice(0, 2).map((id) => String(achById.get(id)?.text || "")) }));
  const differentiators = achievements
    .filter((a) => a.metric && /consistent across/.test(String(a.confidence || "")))
    .slice(0, 5).map((a) => ({ text: String(a.text), how: `metric "${a.metric}", ${a.confidence}` }));
  const toolsWithoutEvidence = skills.filter((s) => String(s.category) === "tool" && !((s.evidence as string[]) || []).length).map((s) => String(s.name));

  // Gaps actually seen in evaluated job reports (Machine Summary soft_gaps).
  const reportGaps: { gap: string; job: string }[] = [];
  for (const a of readApplications()) {
    const rp = /\(([^)]+)\)/.exec(String((a as Rec).report || ""))?.[1]?.replace(/^\.\.\//, "");
    if (!rp) continue;
    const txt = (() => { try { return fs.readFileSync(path.join(root(), rp), "utf8"); } catch { return ""; } })();
    const block = /soft_gaps:\s*\n((?:\s+- .+\n)+)/.exec(txt)?.[1] || "";
    for (const g of block.split("\n").map((l) => l.replace(/^\s*-\s*"?|"?\s*$/g, "")).filter(Boolean)) reportGaps.push({ gap: g, job: `${(a as Rec).company} — ${(a as Rec).role}` });
  }

  const evaluated = readApplications().flatMap((a) => {
    const rp = /\(([^)]+)\)/.exec(String((a as Rec).report || ""))?.[1]?.replace(/^\.\.\//, "");
    if (!rp) return [];
    try { const md = fs.readFileSync(path.join(root(), rp), "utf8"); const model = parseReportModel(md); return [{ company: String((a as Rec).company), role: String((a as Rec).role), n: String((a as Rec).n), date: model.date || String((a as Rec).date || ""), model }]; } catch { return []; }
  });
  const swot = computeSwot({ achievements, skills, employment, projects, discrepancies: readJson<Rec[]>(path.join(kb, "discrepancies.json"), []), reports: evaluated, kbDir: kb, cvPath: path.join(root(), "cv.md") });

  return {
    swot,
    overview: {
      name: profile.name,
      headline: user.headline || String(narrative.headline || ""),
      headlineEdited: !!user.headline,
      summary: user.summary || cvSummary,
      summarySource: user.summary ? "edited in Career Hub" : "from your resume (cv.md)",
      experience: { months, label: `${Math.floor(months / 12)} years ${months % 12} months`, basis: "resume-stated dates, overlapping work counted once; provisional until LinkedIn export" },
      current,
      expertise: strengths.slice(0, 4).map((s) => s.name),
      targets, locations,
    },
    completion: profile.completion,
    checks: profile.checks,
    preferences: profile.preferences,
    openQuestions: profile.openQuestions,
    employment: employment.map((e) => ({ id: e.id, employer: e.employer, relationship: e.relationship, start: (e.start as Rec)?.value, end: (e.end as Rec)?.value, status: e.status, positions: ((e.positions as Rec[]) || []).map((p) => ({ title: p.title, start: (p.start as Rec)?.value, end: (p.end as Rec)?.value, variants: ((p.title_variants as Rec[]) || []).map((v) => v.title) })) })),
    consulting: consulting.map((c) => ({ id: c.id, name: c.name, trading_name: c.trading_name, role: c.role, start: (c.start as Rec)?.value, status: c.status })),
    projects,
    initiatives: initiatives.map((i) => ({ id: i.id, name: i.name, type: i.type, under: i.under, contribution: i.contribution })),
    achievements: achievements.map((a) => ({ id: a.id, owner: a.owner, text: a.text, metric: a.metric, confidence: a.confidence, review_status: a.review_status })),
    skills: skills.map((s) => ({ id: s.id, name: s.name, category: s.category, evidence: ((s.evidence as string[]) || []).length })),
    insights: {
      strengths, differentiators,
      alignedRoles: { roles: targets, how: "your stated target roles; the evaluator scores each job against them" },
      reportGaps,
      toolsWithoutEvidence,
    },
    library: readLibrary(),
    assets: readAssets(),
    integrations: readIntegrations(),
    resumeStatus: (() => {
      const lib = readLibrary();
      const cvStat = (() => { try { return fs.statSync(path.join(root(), "cv.md")).mtime.toISOString(); } catch { return null; } })();
      return { masterUpdated: cvStat, originals: lib.filter((d) => d.kind === "original").length, tailored: lib.filter((d) => d.kind === "tailored-resume" && !d.archived).length, covers: lib.filter((d) => d.kind === "cover-letter").length };
    })(),
  };
}

// ---------- document library: originals, master, and generated versions per job
export type Doc = { id: string; path: string; kind: "original" | "master" | "tailored-resume" | "cover-letter"; label: string; role?: string; employer?: string; date: string; size: number; archived: boolean; usedFor?: string | null };
export function readLibrary(): Doc[] {
  const meta = readJson<Record<string, { label?: string; archived?: boolean }>>(LIB(), {});
  const docs: Doc[] = [];
  const add = (rel: string, kind: Doc["kind"], label: string, extra: Partial<Doc> = {}) => {
    const abs = path.join(root(), rel); if (!fs.existsSync(abs)) return;
    const st = fs.statSync(abs); const id = crypto.createHash("sha1").update(rel).digest("hex").slice(0, 12);
    docs.push({ id, path: rel, kind, label: meta[id]?.label || label, date: st.mtime.toISOString(), size: st.size, archived: !!meta[id]?.archived, ...extra });
  };
  const src = path.join(root(), "documents", "source");
  for (const f of fs.existsSync(src) ? fs.readdirSync(src) : []) if (/\.(pdf|docx)$/i.test(f)) add(`documents/source/${f}`, "original", `Original upload · ${f}`);
  const masterDir = path.join(root(), "output", "master");
  for (const f of fs.existsSync(masterDir) ? fs.readdirSync(masterDir).filter((x) => /^cv-.*-master\.pdf$/.test(x)) : []) add(`output/master/${f}`, "master", "Master resume (from your career profile)");
  // PDFs Career-ops itself writes to output/ (e.g. batch evaluations): cv-<name>-<report>-<company>-<date>.pdf
  const appsAll = readApplications() as Rec[];
  for (const f of fs.readdirSync(path.join(root(), "output")).filter((x) => x.endsWith(".pdf"))) {
    const m = /-(\d{3})-([a-z0-9-]+?)-(\d{4}-\d{2}-\d{2})\.pdf$/.exec(f);
    const app = m ? appsAll.find((a) => Number(a.num ?? a.n) === Number(m[1])) : undefined;
    add(`output/${f}`, /cover/i.test(f) ? "cover-letter" : "tailored-resume", `${/cover/i.test(f) ? "Cover letter" : "Resume"} · ${app ? `${app.company} ${app.role}` : f}`, { employer: app ? String(app.company) : undefined, role: app ? String(app.role) : undefined, usedFor: app ? `#${m?.[1] ? Number(m[1]) : ""} ${app.company} · ${String(app.status || "")}` : null });
  }
  const packs = path.join(root(), "output", "packs");
  const apps = readApplications() as Rec[];
  for (const d of fs.existsSync(packs) ? fs.readdirSync(packs) : []) {
    const pj = readJson<Rec | null>(path.join(packs, d, "pack.json"), null);
    const num = Number(d.split("-")[0]);
    const app = apps.find((a) => Number(a.num ?? a.n) === num);
    const employer = String(app?.company || d.split("-")[1] || ""); const role = String(app?.role || "");
    const used = app ? `#${num} ${employer} · ${String(app.status || "")}` : null;
    for (const f of fs.readdirSync(path.join(packs, d)).filter((x) => x.endsWith(".pdf"))) {
      const rel = `output/packs/${d}/${f}`;
      const isCover = /cover/i.test(f);
      const current = pj && (pj.cv_pdf === rel || pj.cover_pdf === rel);
      add(rel, isCover ? "cover-letter" : "tailored-resume", `${isCover ? "Cover letter" : "Resume"} · ${employer} ${role}${/-v\d+\.pdf$/.test(f) ? ` (${f.match(/-(v\d+)\.pdf$/)?.[1]})` : ""}${current ? "" : " · superseded"}`, { role, employer, usedFor: current ? used : null });
    }
  }
  return docs.sort((a, b) => b.date.localeCompare(a.date));
}

export function updateDoc(id: string, patch: { label?: string; archived?: boolean }) {
  if (!readLibrary().some((d) => d.id === id)) throw new Error("Unknown document.");
  const meta = readJson<Record<string, Rec>>(LIB(), {});
  meta[id] = { ...(meta[id] || {}), ...(patch.label !== undefined ? { label: String(patch.label).slice(0, 120) } : {}), ...(patch.archived !== undefined ? { archived: !!patch.archived } : {}) };
  writeJson(LIB(), meta);
}

export function docPath(id: string): string | null {
  const d = readLibrary().find((x) => x.id === id); return d ? path.join(root(), d.path) : null;
}

// Saves an uploaded original unchanged into documents/source (never overwrites).
export function saveOriginal(name: string, bytes: Buffer) {
  if (!/\.(pdf|docx)$/i.test(name)) throw new Error("Upload a PDF or DOCX file.");
  if (bytes.length > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB.");
  const isPdf = bytes.subarray(0, 5).toString() === "%PDF-"; const isZip = bytes.subarray(0, 2).toString() === "PK";
  if (!(isPdf || isZip)) throw new Error("That file is not a valid PDF or DOCX.");
  const safe = name.replace(/[^\w.\- ]+/g, "_").slice(0, 100);
  const dir = path.join(root(), "documents", "source"); fs.mkdirSync(dir, { recursive: true });
  let target = path.join(dir, safe); let i = 1;
  while (fs.existsSync(target)) target = path.join(dir, safe.replace(/(\.\w+)$/, `-${i++}$1`));
  fs.writeFileSync(target, bytes);
  return path.relative(root(), target);
}

// ---------- user-editable records
const PROJECT_FIELDS = ["name", "client", "type", "role", "start_text", "end_text", "description", "contribution", "deliverables", "outcomes", "technologies", "skills", "confidentiality", "status", "include_in_resumes", "public_link", "source", "imported_at"];
export function saveProject(input: Rec) {
  const data = userRecords();
  const id = String(input.id || `USR-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`); // unique even within one millisecond
  if (!String(input.name || "").trim()) throw new Error("Project name is required.");
  const clean: Rec = { id, review_status: "needs_confirmation", updated: new Date().toISOString() };
  for (const k of PROJECT_FIELDS) if (k in input) clean[k] = typeof input[k] === "string" ? String(input[k]).slice(0, 2000) : input[k];
  const i = data.projects.findIndex((p) => p.id === id);
  if (i >= 0) data.projects[i] = { ...data.projects[i], ...clean }; else data.projects.push(clean);
  writeJson(USER(), data);
  return clean;
}
export function saveOverview(input: { headline?: string; summary?: string }) {
  const data = userRecords();
  if (input.headline !== undefined) data.headline = String(input.headline).slice(0, 200);
  if (input.summary !== undefined) data.summary = String(input.summary).slice(0, 2000);
  writeJson(USER(), data);
}

// ---------- career assets (portfolio files) and profile links
const ASSETS = () => path.join(kbDir(), "assets.json");
export type Asset = { id: string; path: string; name: string; visibility: "private" | "confidential" | "public-portfolio"; project?: string; added: string; size: number; archived?: boolean };
export function readAssets(): Asset[] {
  return readJson<Asset[]>(ASSETS(), []).filter((a) => fs.existsSync(path.join(root(), a.path)));
}
const VIS = new Set(["private", "confidential", "public-portfolio"]);
export function saveAsset(name: string, bytes: Buffer, visibility: string, project = "") {
  if (!VIS.has(visibility)) throw new Error("Choose who may see this file.");
  if (!/\.(pdf|docx|pptx|png|jpe?g|webp|key|xlsx|zip)$/i.test(name)) throw new Error("Supported: PDF, DOCX, PPTX, XLSX, PNG, JPG, WEBP, ZIP.");
  if (bytes.length > 25 * 1024 * 1024) throw new Error("File is larger than 25 MB.");
  const dir = path.join(root(), "documents", "portfolio"); fs.mkdirSync(dir, { recursive: true });
  const safe = name.replace(/[^\w.\- ]+/g, "_").slice(0, 100);
  let target = path.join(dir, safe); let i = 1;
  while (fs.existsSync(target)) target = path.join(dir, safe.replace(/(\.\w+)$/, `-${i++}$1`));
  fs.writeFileSync(target, bytes);
  const all = readJson<Asset[]>(ASSETS(), []);
  const a: Asset = { id: crypto.randomUUID().slice(0, 12), path: path.relative(root(), target), name, visibility: visibility as Asset["visibility"], project: project.slice(0, 120), added: new Date().toISOString(), size: bytes.length };
  all.push(a); writeJson(ASSETS(), all); return a;
}
export function updateAsset(id: string, patch: Partial<Pick<Asset, "visibility" | "project" | "archived">>) {
  const all = readJson<Asset[]>(ASSETS(), []); const a = all.find((x) => x.id === id);
  if (!a) throw new Error("Unknown file.");
  if (patch.visibility && !VIS.has(patch.visibility)) throw new Error("Invalid visibility.");
  Object.assign(a, patch); writeJson(ASSETS(), all);
}
export function assetPath(id: string) { const a = readAssets().find((x) => x.id === id); return a ? path.join(root(), a.path) : null; }

// Integrations registry. A saved URL is a link, never a connection.
export const SERVICES = [
  { id: "linkedin", name: "LinkedIn profile", kind: "link", contributes: "Profile link on resumes and outreach", pattern: /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i },
  { id: "github", name: "GitHub", kind: "public-api", contributes: "Public repositories as project evidence", pattern: /^https?:\/\/(www\.)?github\.com\/[\w-]+\/?$/i },
  { id: "behance", name: "Behance", kind: "link", contributes: "Design portfolio link", pattern: /^https?:\/\/(www\.)?behance\.net\/[\w-]+\/?$/i },
  { id: "dribbble", name: "Dribbble", kind: "link", contributes: "Design portfolio link", pattern: /^https?:\/\/(www\.)?dribbble\.com\/[\w-]+\/?$/i },
  { id: "gitlab", name: "GitLab", kind: "link", contributes: "Code portfolio link", pattern: /^https?:\/\/(www\.)?gitlab\.com\/[\w.-]+\/?$/i },
  { id: "website", name: "Personal website", kind: "link", contributes: "Portfolio / case studies link", pattern: /^https?:\/\/[\w.-]+\.[a-z]{2,}(\/.*)?$/i },
] as const;
type Links = Record<string, { url: string; saved: string; sync?: { at: string; repos: { name: string; url: string; description: string | null; language: string | null; updated: string }[] } }>;
const linksOf = () => (userRecords() as unknown as { links?: Links }).links || {};
export function saveLink(service: string, url: string) {
  const svc = SERVICES.find((s) => s.id === service); if (!svc) throw new Error("Unknown service.");
  const data = userRecords() as unknown as Record<string, unknown>; const links = (data.links || {}) as Links;
  if (!url) { delete links[service]; } else {
    let u = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    try { const x = new URL(u); x.hash = ""; x.search = ""; x.protocol = "https:"; u = x.toString().replace(/\/+$/, ""); } catch { throw new Error(`That does not look like a ${svc.name} profile URL.`); }
    if (!svc.pattern.test(u)) throw new Error(`That does not look like a ${svc.name} profile URL.`);
    links[service] = { url: u, saved: new Date().toISOString() };
  }
  data.links = links; writeJson(USER(), data);
}
// GitHub's official public REST API (no sign-in): lists public repositories for the saved profile.
export async function refreshGithub() {
  const data = userRecords() as unknown as Record<string, unknown>; const links = (data.links || {}) as Links;
  const gh = links.github; if (!gh) throw new Error("Save your GitHub profile URL first.");
  const user = gh.url.replace(/\/+$/, "").split("/").pop();
  const r = await fetch(`https://api.github.com/users/${encodeURIComponent(user || "")}/repos?per_page=100&sort=updated`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "arka-tech-local" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(r.status === 404 ? "GitHub says that user does not exist." : `GitHub returned HTTP ${r.status}.`);
  const repos = ((await r.json()) as Record<string, unknown>[]).filter((x) => !x.fork).map((x) => ({ name: String(x.name), url: String(x.html_url), description: (x.description as string) || null, language: (x.language as string) || null, updated: String(x.pushed_at || x.updated_at) }));
  gh.sync = { at: new Date().toISOString(), repos }; data.links = links; writeJson(USER(), data);
  return gh.sync;
}
// Explicit repository import: preview first (nothing saved), then import the ones you pick.
export async function previewGithubRepos() {
  const gh = linksOf().github; if (!gh) throw new Error("Save your GitHub profile URL first.");
  const user = gh.url.replace(/\/+$/, "").split("/").pop();
  const r = await fetch(`https://api.github.com/users/${encodeURIComponent(user || "")}/repos?per_page=100&sort=updated`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "aarka-tech-local" }, signal: AbortSignal.timeout(20000) });
  if (r.status === 403 || r.status === 429) {
    const reset = Number(r.headers.get("x-ratelimit-reset") || 0);
    throw new Error(`GitHub's public limit is reached for now${reset ? `; try again after ${new Date(reset * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}.`);
  }
  if (!r.ok) throw new Error(r.status === 404 ? "GitHub says that user does not exist." : `GitHub returned HTTP ${r.status}.`);
  const have = new Set(userRecords().projects.map((p) => String(p.public_link || "").toLowerCase()).filter(Boolean));
  return ((await r.json()) as Record<string, unknown>[]).map((x) => ({
    name: String(x.name), url: String(x.html_url), description: (x.description as string) || null, language: (x.language as string) || null,
    updated: String(x.pushed_at || x.updated_at), fork: !!x.fork, stars: Number(x.stargazers_count || 0), imported: have.has(String(x.html_url).toLowerCase()),
  }));
}
export function importGithubRepos(repos: { name: string; url: string; description?: string | null; language?: string | null }[]) {
  const have = new Set(userRecords().projects.map((p) => String(p.public_link || "").toLowerCase()));
  const at = new Date().toISOString(); const added: string[] = [];
  for (const r of repos.slice(0, 50)) {
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(r.url) || have.has(r.url.toLowerCase())) continue;
    saveProject({ name: r.name, type: "Open-source / personal project", description: r.description || "", technologies: r.language || "", public_link: r.url, source: "GitHub public API", imported_at: at, include_in_resumes: false });
    have.add(r.url.toLowerCase()); added.push(r.name);
  }
  return { added, at };
}
export function readIntegrations() {
  const links = linksOf();
  // LinkedIn may only be in your profile (from the resume); show it the same way.
  if (!links.linkedin) { const li = readProfile().preferences.linkedin; if (li) links.linkedin = { url: `https://${li.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`, saved: "" }; }
  return SERVICES.map((s) => ({ id: s.id, name: s.name, kind: s.kind, contributes: s.contributes, url: links[s.id]?.url || null, saved: links[s.id]?.saved || null, lastSync: links[s.id]?.sync?.at || null, repos: links[s.id]?.sync?.repos?.length ?? null, topRepos: (links[s.id]?.sync?.repos || []).slice(0, 5) }));
}
