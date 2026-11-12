// Aarka Tech automation status: a read-only view over files the local pipeline
// already writes. No AI, no network. Every number here comes from a real file;
// a missing file yields `null`, never a made-up value.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { careerOpsRoot, readApplications } from "@/lib/career-ops";
import { listScheduledJobs, setScheduledJobStatus } from "@/lib/scheduled-jobs";

export function automationDir(): string {
  // An `automation/` folder inside the checkout (the public release layout) wins over the
  // older separate ~/career-ops-automation folder; ARKA_AUTOMATION_DIR overrides both.
  if (process.env.ARKA_AUTOMATION_DIR) return process.env.ARKA_AUTOMATION_DIR;
  const inRepo = path.join(careerOpsRoot(), "automation");
  return fs.existsSync(path.join(inRepo, "daily.sh")) ? inRepo : path.join(os.homedir(), "career-ops-automation");
}

const readJson = <T,>(p: string): T | null => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")) as T; } catch { return null; }
};
const mtime = (p: string): string | null => {
  try { return fs.statSync(p).mtime.toISOString(); } catch { return null; }
};

type Stage = { name: string; status: string; detail?: string };
type RunStatus = { started?: string; finished?: string; stages?: Stage[] };
type ScheduledStore = {
  jobs: { id: string; name: string; status: string; nextRunAt?: string; lastRunAt?: string; every: number; unit: string; timezone: string; lastError?: string }[];
  runs: { id: string; jobId: string; at: string; state: string; message?: string; rolesFound?: number; durationMs?: number }[];
};

export type ActivityItem = { at: string; kind: "scan" | "pipeline" | "status" | "document" | "followup" | "email"; ok: boolean; text: string; href?: string };

export type AutomationStatus = {
  paused: boolean;
  scheduler: { installed: boolean; lastCheckAt: string | null };
  schedules: { id: string; name: string; active: boolean; nextRunAt: string | null; cadence: string; timezone: string; lastError: string | null }[];
  nextRunAt: string | null;
  lastScan: { at: string; status: string; found: number; added: number } | null;
  lastPipelineRun: { finished: string | null; failed: number; stages: Stage[] } | null;
  runNowQueued: boolean;
  queue: { rank: number; evaluate: number; pack: number } | null;
  aiEnabled: boolean;
  counts: { tracked: number; evaluated: number; applied: number; interviewing: number; offers: number };
  activity: ActivityItem[];
  gmail: { connected: boolean; clientConfigured: boolean };
  aiProvidersReady: number | null;
};

function lastScanRow(root: string) {
  try {
    const lines = fs.readFileSync(path.join(root, "data", "scan-runs.tsv"), "utf8").trim().split("\n");
    const head = lines[0].split("\t");
    const rows = lines.slice(1).map((l) => Object.fromEntries(l.split("\t").map((v, i) => [head[i], v])));
    return rows;
  } catch { return []; }
}

export function readAutomationStatus(): AutomationStatus {
  const root = careerOpsRoot();
  const auto = automationDir();
  const store = readJson<ScheduledStore>(path.join(root, "data", "scheduled-jobs.json"));
  const run = readJson<RunStatus>(path.join(auto, "logs", "runs", "latest.json"));
  const queue = readJson<{ need_rank: unknown[]; need_eval: unknown[]; need_pack: unknown[] }>(path.join(root, "data", "hub", "ai-queue.json"));
  const config = (() => { try { return fs.readFileSync(path.join(auto, "config.env"), "utf8"); } catch { return ""; } })();
  const scans = lastScanRow(root);
  const last = scans.at(-1);

  const schedules = (store?.jobs || []).map((j) => ({
    id: j.id, name: j.name, active: j.status === "active", nextRunAt: j.status === "active" ? j.nextRunAt || null : null,
    cadence: j.every === 1 ? `every ${j.unit.replace(/s$/, "")}` : `every ${j.every} ${j.unit}`, timezone: j.timezone, lastError: j.lastError || null,
  }));
  const next = schedules.map((s) => s.nextRunAt).filter(Boolean).sort()[0] || null;

  const apps = readApplications();
  const st = (re: RegExp) => apps.filter((a) => re.test(String(a.status || ""))).length;

  // Recent activity: only events a job seeker acts on, each linked to its record.
  const activity: ActivityItem[] = [];
  const appName = (n: string) => { const a = apps.find((x) => String((x as Record<string, unknown>).num ?? (x as Record<string, unknown>).n) === n) as Record<string, unknown> | undefined; return a ? `${a.company} — ${a.role}` : `application #${n}`; };
  for (const r of scans) {
    const added = Number(r.new_added) || 0;
    if (added > 0) activity.push({ at: r.timestamp, kind: "scan", ok: true, text: `${added} new matching role${added === 1 ? "" : "s"} found`, href: "/explore?view=fresh" });
  }
  for (const r of (store?.runs || [])) if (r.state === "failed") activity.push({ at: r.at, kind: "scan", ok: false, text: `Scheduled scan failed: ${r.message || "see Automation"}`, href: "/scheduled-scans" });
  try {
    const files = fs.readdirSync(path.join(auto, "logs", "runs")).filter((f) => /^\d{4}-\d{2}-\d{2}_\d{4}\.json$/.test(f)).sort().slice(-20);
    for (const f of files) {
      const r = readJson<RunStatus>(path.join(auto, "logs", "runs", f));
      for (const st of (r?.stages || [])) if ((st.status === "failed" || st.status === "partial") && r?.finished) activity.push({ at: r.finished, kind: "pipeline", ok: false, text: `Pipeline ${st.name} ${st.status}: ${String(st.detail || "").slice(0, 90)}`, href: "/scheduled-scans" });
    }
  } catch { /* no runs yet */ }
  try {
    for (const line of fs.readFileSync(path.join(root, "data", "status-log.tsv"), "utf8").trim().split("\n")) {
      const [n, date, from, to] = line.split("\t");
      if (n && to && from !== to) activity.push({ at: `${date}T12:00:00`, kind: "status", ok: true, text: `${appName(n)}: ${from} → ${to}`, href: `/pipeline/${n}` });
    }
  } catch { /* no status log */ }
  try {
    for (const d of fs.readdirSync(path.join(root, "output", "packs"))) {
      const pj = readJson<Record<string, string | null>>(path.join(root, "output", "packs", d, "pack.json"));
      if (!pj) continue;
      const n = String(Number(d.split("-")[0]));
      for (const [k, label] of [["cv_pdf", "Tailored resume"], ["cover_pdf", "Cover letter"]] as const) {
        const rel = pj[k]; if (!rel) continue;
        const m = mtime(path.join(root, rel)); if (m) activity.push({ at: m, kind: "document", ok: true, text: `${label} validated for ${appName(n)}`, href: "/documents" });
      }
    }
  } catch { /* no packs */ }
  try {
    for (const m of fs.readFileSync(path.join(root, "data", "follow-ups.md"), "utf8").matchAll(/^- next #(\d+) (\d{4}-\d{2}-\d{2}) \(set (\d{4}-\d{2}-\d{2})\)/gm)) {
      activity.push({ at: `${m[3]}T12:00:00`, kind: "followup", ok: true, text: `Follow-up scheduled for ${m[2]}: ${appName(m[1])}`, href: "/followups" });
    }
  } catch { /* none */ }
  try {
    for (const line of fs.readFileSync(path.join(root, "data", "hub", "gmail-drafts.tsv"), "utf8").trim().split("\n").slice(1)) {
      const [created, , to, subject] = line.split("\t");
      if (created) activity.push({ at: created, kind: "email", ok: true, text: `Gmail draft saved: "${subject}" to ${to}`, href: "/followups" });
    }
  } catch { /* no drafts */ }
  // de-duplicate identical messages, keep the newest
  const seen = new Set<string>();
  // Compare real times: sources write ISO, date-only and local formats, so string order is wrong.
  const t = (x: string) => { const v = Date.parse(x); return Number.isFinite(v) ? v : 0; };
  activity.sort((a, b) => t(b.at) - t(a.at));
  const dedup = activity.filter((a) => (seen.has(a.text) ? false : (seen.add(a.text), true)));

  return {
    paused: fs.existsSync(path.join(auto, "PAUSE")),
    scheduler: {
      installed: fs.existsSync(path.join(os.homedir(), "Library", "LaunchAgents", "io.career-ops.scheduled-scan.plist")),
      lastCheckAt: mtime(path.join(root, "data", "scheduled-jobs.json.tick")),
    },
    schedules,
    nextRunAt: next,
    lastScan: last ? { at: last.timestamp, status: last.status, found: Number(last.found) || 0, added: Number(last.new_added) || 0 } : null,
    lastPipelineRun: run ? { finished: run.finished || null, failed: (run.stages || []).filter((s) => s.status === "failed").length, stages: run.stages || [] } : null,
    runNowQueued: fs.existsSync(path.join(auto, "state", "run-now")),
    queue: queue ? { rank: queue.need_rank.length, evaluate: queue.need_eval.length, pack: queue.need_pack.length } : null,
    aiEnabled: /^AI_ENABLED=1/m.test(config),
    counts: {
      tracked: apps.length,
      evaluated: st(/evaluated/i),
      applied: st(/applied|responded|assessment/i),
      interviewing: st(/interview/i),
      offers: st(/offer/i),
    },
    activity: dedup.slice(0, 8),
    gmail: {
      connected: fs.existsSync(path.join(os.homedir(), "Library", "Application Support", "careerops", "gmail-token.json")),
      clientConfigured: fs.existsSync(path.join(os.homedir(), "Library", "Application Support", "careerops", "gmail-client.json")),
    },
    aiProvidersReady: (() => {
      const pol = readJson<{ providers: Record<string, { enabled?: boolean }> }>(path.join(auto, "ai-engine", "state", "policy.json"));
      const h = readJson<Record<string, { lastSuccessAt?: string | null; lastErrorStatus?: string | null; lastCheckStatus?: string | null }>>(path.join(auto, "ai-engine", "state", "health.json")) || {};
      if (!pol) return null;
      return Object.entries(pol.providers).filter(([id, c]) => c.enabled && (h[id]?.lastSuccessAt || id === "claude") && !h[id]?.lastErrorStatus).length;
    })(),
  };
}

// Global pause: stops our pipeline (PAUSE file, honoured by tick.sh/daily.sh) AND
// pauses every active Scheduled scan, remembering which ones so Resume only
// re-activates what Pause stopped.
export async function setPaused(paused: boolean) {
  const auto = automationDir();
  const p = path.join(auto, "PAUSE");
  const memo = path.join(auto, "state", "paused-schedules.json");
  fs.mkdirSync(path.dirname(memo), { recursive: true });
  if (paused) {
    const active = listScheduledJobs().jobs.filter((j) => j.status === "active").map((j) => j.id);
    for (const id of active) await setScheduledJobStatus(id, "paused");
    const prior = readJson<string[]>(memo) || [];
    fs.writeFileSync(memo, JSON.stringify([...new Set([...prior, ...active])]));
    fs.writeFileSync(p, `paused from the Aarka Tech dashboard ${new Date().toISOString()}\n`);
  } else {
    for (const id of readJson<string[]>(memo) || []) await setScheduledJobStatus(id, "active");
    if (fs.existsSync(memo)) fs.unlinkSync(memo);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

export function queueFullRun() {
  const dir = path.join(automationDir(), "state");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "run-now"), new Date().toISOString());
}
