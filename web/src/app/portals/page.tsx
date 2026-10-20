import { Radar } from "lucide-react";
import path from "node:path";
import { PortalsView } from "@/components/portals-view";
import { careerOpsRoot, pipelineSummary, portalsConfigPath } from "@/lib/career-ops";
import type { CompanyActivity } from "@/components/portals-view";
import { loadPortalsDocument, watchedCompanies, type WatchedCompany } from "@/lib/portals-config.mjs";

export const dynamic = "force-dynamic";

function readWatched(): { watched: WatchedCompany[]; error: string | null } {
  const root = careerOpsRoot();
  try {
    const { doc, seeded } = loadPortalsDocument(portalsConfigPath(root), path.join(root, "templates", "portals.example.yml"));
    return { watched: seeded ? [] : watchedCompanies(doc), error: null };
  } catch (e) {
    return { watched: [], error: e instanceof Error ? e.message : String(e) };
  }
}

// Per-company activity from the local tracker and inbox, so each source shows what it produced.
function readActivity(): Record<string, CompanyActivity> {
  const out: Record<string, CompanyActivity> = {};
  try {
    const { inbox, applications } = pipelineSummary();
    const k = (s: string) => s.trim().toLowerCase();
    for (const j of inbox) { if (j.done) continue; const e = (out[k(j.company)] ||= { open: 0, tracked: [] }); e.open++; }
    for (const a of applications) {
      const e = (out[k(a.company)] ||= { open: 0, tracked: [] });
      e.tracked.push({ n: a.n, role: a.role, status: a.status, score: a.score });
    }
  } catch { /* tracker missing */ }
  return out;
}

export default function PortalsPage() {
  const { watched, error } = readWatched();
  const activity = readActivity();
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 max-sm:px-4">
      <div className="flex items-center gap-3">
        <Radar className="size-6 text-brand" />
        <h1 className="font-display text-2xl tracking-tight text-landing">Job Sources</h1>
      </div>
      <p className="mt-1.5 max-w-2xl text-sm text-muted">
        The company career pages Aarka checks for new roles, and what each one has produced for you. Run a health check to catch a board that quietly stopped answering.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          Could not read <code>portals.yml</code>: {error}
        </p>
      )}
      <div className="mt-6">
        <PortalsView watched={watched} activity={activity} />
      </div>
    </div>
  );
}
