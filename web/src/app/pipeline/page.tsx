import { Suspense } from "react";
import { pipelineSummary } from "@/lib/career-ops";
import { pendingInbox } from "@/lib/inbox-pending.mjs";
import { PipelineView } from "@/components/pipeline-view";
import { pipelineTab } from "@/lib/pipeline-navigation.mjs";
import { evaluationFor, type Evaluation } from "@/lib/arka/evaluations";

export const dynamic = "force-dynamic"; // always read fresh local files

// Tracker tabs show the inbox only as a count, so they get the count and not
// the postings. The inbox is most of the page payload on a large pipeline.
export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  // No tab → the board of tracked roles; tab=INBOX → new postings to triage.
  const board = tab == null || tab === "";
  const onInbox = !board && pipelineTab(tab) === "INBOX";
  const { inbox, applications } = pipelineSummary();
  const pending = pendingInbox(inbox);
  const evaluations: Record<string, Evaluation | null> = {};
  if (board) for (const a of applications) { try { evaluations[a.n] = evaluationFor(a.n); } catch { evaluations[a.n] = null; } }
  return (
    <Suspense>
      <PipelineView applications={applications} inbox={onInbox ? pending : null} inboxCount={pending.length} board={board} evaluations={evaluations} />
    </Suspense>
  );
}
