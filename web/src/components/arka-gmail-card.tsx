"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Mail, RefreshCw, Upload } from "lucide-react";

type G = { clientConfigured: boolean; connected: boolean; account: string | null; error: string | null };

// Gmail (drafts only). Aarka Tech never sends email from here.
export function ArkaGmailCard() {
  const [g, setG] = useState<G | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadClient = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) { setMsg({ tone: "err", text: "Choose the downloaded JSON file first." }); return; }
    setBusy("upload"); setMsg(null);
    const fd = new FormData(); fd.set("file", f);
    try {
      const r = await fetch("/api/arka/gmail", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg({ tone: "ok", text: j.note }); await load();
    } catch (e) { setMsg({ tone: "err", text: (e as Error).message }); }
    finally { setBusy(null); }
  };
  const load = useCallback(async () => { const r = await fetch("/api/arka/gmail", { cache: "no-store" }); setG(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (action: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action); setMsg(null);
    try {
      const r = await fetch("/api/arka/gmail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg({ tone: "ok", text: j.note || (j.draft ? `Draft created in Gmail (id ${j.draft.draft_id}) with ${j.draft.attachments.length} attachment(s). Open your Drafts folder to see it.` : "Done.") });
      await load();
    } catch (e) { setMsg({ tone: "err", text: (e as Error).message }); }
    finally { setBusy(null); }
  };

  return (
    <section id="gmail" className="rounded-xl border border-border bg-surface p-5 max-sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-foreground"><Mail className="size-5 text-brand-text" /> Gmail (drafts only)</h2>
          <p className="mt-0.5 text-sm text-muted">Saves recruiter and application emails, with your resume and cover letter attached, to your Gmail Drafts. Nothing is ever sent from Aarka Tech.</p>
        </div>
        <button type="button" onClick={load} aria-label="Refresh Gmail status" className="min-h-8 rounded-md border border-border px-2 text-muted hover:text-foreground"><RefreshCw className="size-3.5" /></button>
      </div>
      {!g ? <p className="mt-3 text-sm text-muted">Checking…</p> : (
        <>
          <p className="mt-3 text-sm font-semibold text-foreground">
            {g.connected ? `Connected: ${g.account}` : g.clientConfigured ? "Ready to connect" : "Not set up"}
            {g.error ? <span className="block text-xs font-normal text-red-600 dark:text-red-400">{g.error}</span> : null}
          </p>
          {!g.clientConfigured && (
            <details className="mt-3 rounded-lg border border-border p-3 text-sm text-muted">
              <summary className="cursor-pointer font-semibold text-foreground">One-time setup: get your Google client file</summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                <li>Open <a className="font-semibold text-brand-text hover:underline" href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud <ExternalLink className="inline size-3" /></a>, create a project and enable the Gmail API.</li>
                <li>OAuth consent screen: type External, add your Gmail address as a test user.</li>
                <li>Credentials → Create OAuth client ID → <b>Desktop app</b> → Download JSON.</li>
                <li>Upload that file below. It stays on this Mac.</li>
              </ol>
            </details>
          )}
          {!g.clientConfigured && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="application/json,.json" aria-label="Google OAuth client file" className="min-w-0 text-xs text-muted file:mr-2 file:rounded-md file:border file:border-border file:bg-surface file:px-2 file:py-1 file:text-xs" />
              <button type="button" disabled={!!busy} onClick={uploadClient} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-foreground disabled:opacity-50">
                {busy === "upload" ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />} Upload client file
              </button>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {g.clientConfigured && !g.connected && (
              <button type="button" disabled={!!busy} onClick={() => act("connect")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-foreground disabled:opacity-50">
                {busy === "connect" ? <Loader2 className="size-3 animate-spin" /> : null} Connect Gmail account
              </button>
            )}
            {g.connected && (
              <>
                <button type="button" disabled={!!busy} onClick={() => act("test-draft")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-foreground disabled:opacity-50">
                  {busy === "test-draft" ? <Loader2 className="size-3 animate-spin" /> : null} Create test draft to myself
                </button>
                <button type="button" disabled={!!busy} onClick={() => act("disconnect", "Disconnect Gmail and revoke Aarka Tech's access?")} className="min-h-9 rounded-lg border border-red-500/40 px-3 text-xs font-semibold text-red-600 dark:text-red-400 disabled:opacity-50">Disconnect</button>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-faint">Permission requested: gmail.compose only (create drafts). Google bundles sending into that permission, but Aarka Tech has no send function. While the Google app is in Testing mode, Google asks you to reconnect every 7 days.</p>
          {msg && <p role="status" className={`mt-3 text-sm ${msg.tone === "err" ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{msg.text}</p>}
        </>
      )}
    </section>
  );
}
