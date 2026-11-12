import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, readApplications, type Application } from "@/lib/career-ops";
import { runCoreCli, runSetStatus } from "@/lib/core-cli";
import { companyName } from "@/lib/arka/normalize.mjs";

// "Mark already applied": records that the candidate applied themselves (Aarka Tech never
// submits anything). Updates the existing tracker row when the job is already tracked,
// otherwise adds one through the tracker's own merge path. Notes say it was user-reported.

export type AppliedInput = { n?: string; url?: string; company?: string; role?: string; location?: string; date?: string; note?: string; source?: string };
export type AppliedResult = { n: string; created: boolean; previousStatus: string | null; status: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const norm = (s: string) => companyName(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const roleKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function urlKey(raw: string) {
  try {
    const u = new URL(raw.trim());
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|ref$|source$|src$|gh_src$|lever-source)/i.test(k)) u.searchParams.delete(k);
    u.hash = "";
    return `${u.host.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch { return ""; }
}
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\t\r\n|]+/g, " ").trim().slice(0, n);

/** The tracked application this job already is, by URL or by employer + title. */
export function findTracked(input: { url?: string; company?: string; role?: string }, apps: Application[] = readApplications()): Application | undefined {
  const k = input.url ? urlKey(input.url) : "";
  if (k) { const hit = apps.find((a) => a.url && urlKey(a.url) === k); if (hit) return hit; }
  if (input.company && input.role) {
    const c = norm(input.company), r = roleKey(input.role);
    return apps.find((a) => norm(a.company) === c && roleKey(a.role) === r);
  }
  return undefined;
}

export async function markApplied(input: AppliedInput): Promise<AppliedResult> {
  const date = input.date && DATE.test(input.date) ? input.date : today();
  if (date > today()) throw new Error("The application date can't be in the future.");
  const note = `Applied (user-reported) ${date}${input.note ? `: ${clean(input.note, 300)}` : ""}`;
  const apps = readApplications();
  const existing = input.n ? apps.find((a) => String(a.n) === String(input.n)) : findTracked(input, apps);
  if (existing) {
    const r = await runSetStatus(["--row", String(existing.n), "Applied", "--note", note, "--on", date, "--source", "web", "--json"]);
    if (r.code !== 0) throw new Error(errorText(r.stdout, r.stderr) || "Could not update the application.");
    return { n: String(existing.n), created: false, previousStatus: existing.status, status: "Applied" };
  }
  const company = clean(input.company, 120), role = clean(input.role, 200);
  if (!company || !role) throw new Error("Employer and job title are needed to add this application.");
  const next = apps.reduce((m, a) => Math.max(m, Number(a.n) || 0), 0) + 1;
  const dir = path.join(careerOpsRoot(), "batch", "tracker-additions");
  fs.mkdirSync(dir, { recursive: true });
  const notes = [note, input.url ? `URL: ${clean(input.url, 500)}` : "", input.location ? `Location: ${clean(input.location, 120)}` : "", `Source: ${clean(input.source || "manual", 40)}`].filter(Boolean).join("; ");
  const file = path.join(dir, `${String(next).padStart(3, "0")}-user-applied-${Date.now()}.tsv`);
  fs.writeFileSync(file, `#\tDate\tCompany\tRole\tScore\tStatus\tPDF\tReport\tNotes\n${next}\t${date}\t${company}\t${role}\tN/A\tApplied\t❌\tN/A\t${notes}\n`);
  const r = await runCoreCli("merge-tracker", []);
  const added = readApplications().find((a) => norm(a.company) === norm(company) && roleKey(a.role) === roleKey(role));
  if (r.code !== 0 || !added) throw new Error(errorText(r.stdout, r.stderr) || "The tracker did not accept the new row.");
  return { n: String(added.n), created: true, previousStatus: null, status: added.status };
}

function errorText(stdout: string, stderr: string) {
  try { const j = JSON.parse(stdout); return j.error || j.message || ""; } catch { /* plain */ }
  return (stderr || stdout).split("\n").find((l) => /error|❌|refus|skip/i.test(l))?.trim().slice(0, 300) || "";
}
