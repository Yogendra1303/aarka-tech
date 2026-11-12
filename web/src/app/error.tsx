"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

// Any page that fails to render shows this instead of a blank screen. After an app update an
// open tab can ask for files that no longer exist (a "chunk" error); one reload fixes that.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(`${error?.name} ${error?.message}`);
  useEffect(() => {
    if (!stale) return;
    try { if (sessionStorage.getItem("aarka:reloaded-after-update")) return; sessionStorage.setItem("aarka:reloaded-after-update", "1"); } catch { /* storage off */ }
    location.reload();
  }, [stale]);
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <AlertTriangle className="mx-auto size-8 text-amber-600" />
      <h1 className="mt-3 text-xl font-extrabold text-foreground">{stale ? "Aarka Tech was updated" : "This page could not be shown"}</h1>
      <p className="mt-2 text-sm text-muted">{stale ? "Reload to load the new version. Your data is unchanged." : "Something went wrong while showing this page. Your data is unchanged."}</p>
      {!stale && error?.message && <p className="mt-3 break-words rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-muted">{error.message}</p>}
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" onClick={() => (stale ? location.reload() : reset())} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground"><RotateCcw className="size-4" /> {stale ? "Reload" : "Try again"}</button>
        <a href="/" className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground">Dashboard</a>
      </div>
    </div>
  );
}
