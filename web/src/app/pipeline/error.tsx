"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

// Shown when the tracker or the new-postings file can't be read, instead of a page that never finishes loading.
export default function ApplicationsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <AlertTriangle className="mx-auto size-8 text-amber-600" />
      <h1 className="mt-3 text-xl font-extrabold text-foreground">Applications could not be loaded</h1>
      <p className="mt-2 text-sm text-muted">Aarka Tech couldn&apos;t read your tracker (data/applications.md) or new postings (data/pipeline.md). Your files have not been changed.</p>
      {error.message && <p className="mt-3 break-words rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-muted">{error.message}</p>}
      <button type="button" onClick={reset} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground"><RotateCcw className="size-4" /> Try again</button>
    </div>
  );
}
