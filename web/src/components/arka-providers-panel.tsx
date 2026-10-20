"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Bot, ChevronDown, ExternalLink, KeyRound, Loader2, RefreshCw, Terminal } from "lucide-react";
import { persistCliId, readSavedCliId } from "@/lib/saved-cli";

// Aarka Tech — AI Providers & Configuration. One table over the local engine
// (automation/ai-engine), which is the single source of truth for
// provider status, billing, order and keys. Nothing here installs a CLI or signs
// in for you, and a saved key is never sent back to the browser.

type Provider = {
  id: string; name: string; kind: "cli" | "api"; status: string; installed: boolean; enabled: boolean;
  version?: string | null; path?: string | null; detail?: string; billing: string; billingNote?: string;
  tasks?: string[]; model?: string | null; models?: string[]; installUrl?: string; signIn?: string;
  keyUrl?: string; usageUrl?: string; pricingUrl?: string; keyHint?: string | null; billingAck?: boolean;
  needsAccountId?: boolean; accountId?: string | null; usage?: Record<string, unknown> | null; rate?: Record<string, string> | null;
  lastSuccessAt: string | null; lastError: string | null; lastErrorAt: string | null;
};
type Status = { policy: { paused: boolean; order: Record<string, string[]> }; providers: Provider[] };
type Filter = "all" | "cli" | "api";

const STATUS_LABEL: Record<string, string> = {
  available: "Ready", not_installed: "Not installed", authentication_required: "Sign-in needed", quota_exhausted: "Quota or rate limit reached",
  temporarily_unavailable: "Temporarily unavailable", unsupported: "Unsupported", unknown: "Not verified",
  key_missing: "No key entered", key_saved_untested: "Key saved, not tested", invalid_key: "Key invalid or unauthorized", account_id_missing: "Needs account ID", error: "Error",
};
const statusTone = (s: string) => (s === "available" ? "text-foreground" : s === "not_installed" || s === "key_missing" ? "text-faint" : s === "unknown" || s === "key_saved_untested" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400");
const dot = (s: string) => (s === "available" ? "bg-brand" : s === "not_installed" || s === "key_missing" ? "bg-border" : s === "unknown" || s === "key_saved_untested" ? "bg-amber-400" : "bg-red-500");
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null);

export function ArkaProvidersPanel() {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ id?: string; tone: "ok" | "err"; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [appCli, setAppCli] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/arka/providers", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setData(j); setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); setAppCli(readSavedCliId()); }, [load]);

  const act = async (body: Record<string, unknown>, key: string, okText?: (res: Record<string, unknown> | null) => string) => {
    setBusy(key); setNote(null);
    try {
      const r = await fetch("/api/arka/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
      if (okText) setNote({ id: body.provider as string, tone: "ok", text: okText(j.result) });
      await load();
      return j.result as Record<string, unknown>;
    } catch (e) {
      setNote({ id: body.provider as string, tone: "err", text: (e as Error).message });
      await load();
      return null;
    } finally { setBusy(null); }
  };

  const order = data?.policy.order.default || [];
  const byId = Object.fromEntries((data?.providers || []).map((p) => [p.id, p]));
  const rows = order.map((id) => byId[id]).filter(Boolean).filter((p) => filter === "all" || p.kind === filter);
  const ready = (data?.providers || []).filter((p) => p.enabled && p.status === "available").length;
  const move = (id: string, d: -1 | 1) => {
    const next = [...order]; const i = next.indexOf(id); const j = i + d; if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    act({ action: "order", order: next }, "order");
  };
  const toggle = (p: Provider, on: boolean) => {
    if (!on && p.enabled && !window.confirm(`Disable ${p.name}? Tasks will use the next provider in your order.`)) return;
    act({ action: "set", provider: p.id, enabled: on }, `set-${p.id}`, () => (on ? `${p.name} enabled for fallback.` : `${p.name} disabled.`));
  };
  const testText = (res: Record<string, unknown> | null) =>
    res?.status === "done" || res?.status === "available"
      ? `Test passed: valid JSON returned${res.model ? ` by ${res.model}` : ""}.`
      : `Test did not pass: ${STATUS_LABEL[String(res?.status)] || res?.status}${res?.error ? ` — ${res.error}` : ""}`;

  const enabledBox = (p: Provider) => {
    const blocked = p.kind === "api" ? !(p.billingAck && p.status === "available") : !p.installed;
    return (
      <input type="checkbox" aria-label={`Enable ${p.name}`} checked={p.enabled} disabled={!!busy || (blocked && !p.enabled)}
        title={blocked && !p.enabled ? (p.kind === "api" ? "Validate the key and acknowledge billing first" : "Install the CLI first") : undefined}
        onChange={(e) => toggle(p, e.target.checked)} className="size-4 accent-[#EC5E27]" />
    );
  };
  const testBtn = (p: Provider) => (
    <button type="button" onClick={() => act({ action: "test", provider: p.id }, `test-${p.id}`, testText)} disabled={!!busy || !p.installed || (p.kind === "cli" && !p.enabled)}
      className="inline-flex min-h-8 items-center gap-1 rounded-md bg-brand px-2.5 text-xs font-semibold text-brand-foreground disabled:opacity-40">
      {busy === `test-${p.id}` ? <Loader2 className="size-3 animate-spin" /> : null} Test
    </button>
  );
  const priority = (p: Provider) => {
    const i = order.indexOf(p.id);
    return (
      <span className="inline-flex items-center gap-1 tabular-nums text-faint">
        {i + 1}
        <button type="button" aria-label={`Move ${p.name} up`} onClick={() => move(p.id, -1)} disabled={!!busy || i === 0} className="disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
        <button type="button" aria-label={`Move ${p.name} down`} onClick={() => move(p.id, 1)} disabled={!!busy || i === order.length - 1} className="disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
      </span>
    );
  };
  const activity = (p: Provider) => (
    <span className="text-xs text-muted">
      {p.lastSuccessAt ? `OK ${when(p.lastSuccessAt)}` : "No successful call yet"}
      {p.lastError ? <span className="block text-red-600 dark:text-red-400">{p.lastError.slice(0, 110)}</span> : null}
    </span>
  );

  return (
    <section aria-labelledby="ai-providers-title" className="rounded-xl border border-border bg-surface p-5 max-sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ai-providers-title" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-foreground"><Bot className="size-5 text-brand-text" /> AI Providers &amp; Configuration</h2>
          <p className="mt-0.5 text-sm text-muted">Manage AI tools, API connections, usage and automatic fallback in one place.</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {data ? `${ready} provider${ready === 1 ? "" : "s"} ready for tasks` : "Checking providers…"}
            {data?.policy.paused ? <span className="ml-2 text-amber-600 dark:text-amber-400">· AI tasks paused</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => act({ action: data?.policy.paused ? "resume" : "pause" }, "pause")} disabled={!data || !!busy}
            className="min-h-8 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:border-brand/50 disabled:opacity-50">
            {data?.policy.paused ? "Resume AI tasks" : "Pause AI tasks"}
          </button>
          <button type="button" onClick={load} aria-label="Refresh status" className="min-h-8 rounded-md border border-border px-2 text-muted hover:text-foreground"><RefreshCw className="size-3.5" /></button>
        </div>
      </div>

      {/* Setup entry points: both open the same provider list, filtered */}
      <div role="tablist" aria-label="Provider type" className="mt-4 flex flex-wrap gap-2">
        {([["all", "All providers", Bot], ["cli", "Use an AI tool you have", Terminal], ["api", "Paste an AI key", KeyRound]] as const).map(([f, label, Icon]) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition ${filter === f ? "border-brand/60 bg-brand-soft text-brand-text" : "border-border text-muted hover:text-foreground"}`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {note && !note.id && <p role="status" className={`mt-3 rounded-lg border px-3 py-2 text-sm ${note.tone === "err" ? "border-red-500/40 text-red-600 dark:text-red-400" : "border-brand/40 text-foreground"}`}>{note.text}</p>}

      {!data ? <p className="mt-4 text-sm text-muted">Checking installed tools and saved keys…</p> : (
        <>
          {/* Desktop table */}
          <div className="mt-4 hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.1em] text-faint">
                <tr><th className="py-2 pr-3">Provider</th><th className="pr-3">Setup</th><th className="pr-3">Model</th><th className="pr-3">Status</th><th className="pr-3">Billing</th><th className="pr-3">Last activity</th><th className="pr-3">Enabled</th><th className="pr-3">Priority</th><th>Test</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <Fragment key={p.id}>
                    <tr className="border-t border-border align-top">
                      <td className="py-2.5 pr-3">
                        <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id} className="text-left">
                          <span className="flex items-center gap-1.5 font-semibold text-foreground">{p.kind === "cli" ? <Terminal className="size-3.5 text-faint" /> : <KeyRound className="size-3.5 text-faint" />}{p.name}<ChevronDown className={`size-3.5 text-faint transition ${open === p.id ? "rotate-180" : ""}`} /></span>
                          <span className="text-xs text-faint">{p.kind === "cli" ? `CLI${p.version ? ` · ${p.version}` : ""}` : `API key${p.keyHint ? ` · ${p.keyHint}` : ""}`}</span>
                        </button>
                      </td>
                      <td className="pr-3"><button type="button" onClick={() => setOpen(p.id)} className="text-xs font-semibold text-brand-text hover:underline">{p.kind === "cli" ? (p.installed ? "Manage" : "Install") : p.keyHint ? "Manage key" : "Add key"}</button></td>
                      <td className="pr-3 text-xs text-muted">{p.model || "—"}</td>
                      <td className={`pr-3 font-semibold ${statusTone(p.status)}`}><span className={`mr-1.5 inline-block size-2 rounded-full ${dot(p.status)}`} />{STATUS_LABEL[p.status] || p.status}</td>
                      <td className="pr-3 text-xs text-muted" title={p.billingNote}>{p.billing}</td>
                      <td className="pr-3">{activity(p)}</td>
                      <td className="pr-3">{enabledBox(p)}</td>
                      <td className="pr-3">{priority(p)}</td>
                      <td>{testBtn(p)}</td>
                    </tr>
                    {open === p.id && <tr><td colSpan={9} className="pb-4"><Setup p={p} busy={busy} act={act} note={note?.id === p.id ? note : null} appCli={appCli} setAppCli={(id) => { persistCliId(id); setAppCli(id); }} /></td></tr>}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-4 space-y-2 md:hidden">
            {rows.map((p) => (
              <li key={p.id} className="rounded-lg border border-border p-3">
                <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id} className="flex w-full items-start justify-between gap-2 text-left">
                  <span><span className="block font-semibold text-foreground">{p.name}</span><span className={`text-xs font-semibold ${statusTone(p.status)}`}>{STATUS_LABEL[p.status] || p.status}</span></span>
                  <ChevronDown className={`mt-1 size-4 text-faint transition ${open === p.id ? "rotate-180" : ""}`} />
                </button>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-faint">Billing</dt><dd className="text-muted">{p.billing}</dd>
                  <dt className="text-faint">Model</dt><dd className="break-all text-muted">{p.model || "—"}</dd>
                  <dt className="text-faint">Last activity</dt><dd>{activity(p)}</dd>
                </dl>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted">{enabledBox(p)} Enabled</label>
                  {priority(p)}
                  {testBtn(p)}
                </div>
                {open === p.id && <div className="mt-3"><Setup p={p} busy={busy} act={act} note={note?.id === p.id ? note : null} appCli={appCli} setAppCli={(id) => { persistCliId(id); setAppCli(id); }} /></div>}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-xs text-faint">
        Fallback: tasks use the first enabled, ready provider in priority order and move to the next only on a confirmed sign-in, quota or temporary error. Finished results are cached and never re-run.
        A provider whose billing is not verified can only be enabled after you acknowledge possible charges. Usage is shown only where the provider reports it.
      </p>
    </section>
  );
}

function Setup({ p, busy, act, note, appCli, setAppCli }: {
  p: Provider; busy: string | null; note: { tone: "ok" | "err"; text: string } | null; appCli: string | null; setAppCli: (id: string) => void;
  act: (body: Record<string, unknown>, key: string, okText?: (res: Record<string, unknown> | null) => string) => Promise<Record<string, unknown> | null>;
}) {
  const [key, setKey] = useState("");
  const [account, setAccount] = useState(p.accountId || "");
  const box = "rounded-lg border border-border bg-background/40 p-4 text-sm";
  const link = (href: string | undefined, text: string, primary = false) => href ? (
    <a href={href} target="_blank" rel="noreferrer" className={primary ? "inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-foreground" : "inline-flex items-center gap-1 text-xs font-semibold text-brand-text hover:underline"}>
      {text} <ExternalLink className="size-3" />
    </a>
  ) : null;
  const msg = note ? <p role="status" className={`mt-3 rounded-md border px-3 py-2 text-xs ${note.tone === "err" ? "border-red-500/40 text-red-600 dark:text-red-400" : "border-brand/40 text-foreground"}`}>{note.text}</p> : null;

  if (p.kind === "cli") {
    return (
      <div className={box}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-faint">Installed</dt><dd className="text-foreground">{p.installed ? `Yes · ${p.path}` : "No"}</dd>
          <dt className="text-faint">Version</dt><dd className="text-foreground">{p.version || "—"}</dd>
          <dt className="text-faint">Sign-in</dt><dd className="text-foreground">{p.detail || "—"}</dd>
          <dt className="text-faint">Billing</dt><dd className="text-foreground">{p.billing}</dd>
          <dt className="text-faint">Tasks</dt><dd className="text-muted">{(p.tasks || []).join(", ").replaceAll("_", " ")}</dd>
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {link(p.installUrl, p.installed ? "Official docs" : "Install instructions", !p.installed)}
          {p.signIn ? <span className="text-xs text-muted">{p.signIn}</span> : null}
          {p.installed && (
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="radio" name="app-cli" checked={appCli === p.id} onChange={() => setAppCli(p.id)} className="accent-[#EC5E27]" /> Use for app actions (evaluate, CV studio, apply)
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-faint">Aarka Tech never installs a CLI or signs in for you. Install it yourself, sign in with your own account, then press Refresh and Test.</p>
        {msg}
      </div>
    );
  }

  const ack = !!p.billingAck;
  return (
    <div className={box}>
      <ol className="space-y-3">
        <li className="flex flex-wrap items-center gap-3"><span className="text-xs font-bold text-faint">1</span>{link(p.keyUrl, "Get API key", true)}<span className="text-xs text-muted">Opens {p.name} in a new tab. Sign in there and create a key.</span></li>
        {p.needsAccountId && (
          <li className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-faint">2</span>
            <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Cloudflare account ID (32 characters)" aria-label="Cloudflare account ID"
              className="min-h-9 w-72 max-w-full rounded-md border border-border bg-surface px-3 font-mono text-xs" />
            <button type="button" disabled={!!busy || !account} onClick={() => act({ action: "account", provider: p.id, accountId: account }, `acct-${p.id}`, () => "Account ID saved.")}
              className="min-h-9 rounded-md border border-border px-3 text-xs font-semibold disabled:opacity-40">Save account ID</button>
          </li>
        )}
        <li className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-faint">{p.needsAccountId ? 3 : 2}</span>
          <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} aria-label={`${p.name} API key`}
            placeholder={p.keyHint ? `Saved key ${p.keyHint} — paste a new key to replace it` : "Paste your API key"}
            className="min-h-9 w-80 max-w-full rounded-md border border-border bg-surface px-3 font-mono text-xs" />
          <button type="button" disabled={!!busy || !key.trim()}
            onClick={async () => { const r = await act({ action: "key-save", provider: p.id, key }, `key-${p.id}`, (res) => (res?.status === "available" ? `Key saved and validated${res.model ? ` (${res.model})` : ""}.` : `Key saved, but validation did not pass: ${STATUS_LABEL[String(res?.status)] || res?.status}${res?.error ? ` — ${res.error}` : ""}`)); if (r) setKey(""); }}
            className="inline-flex min-h-9 items-center gap-1 rounded-md bg-brand px-3 text-xs font-semibold text-brand-foreground disabled:opacity-40">
            {busy === `key-${p.id}` ? <Loader2 className="size-3 animate-spin" /> : null} Validate &amp; Save
          </button>
          {p.keyHint && <button type="button" disabled={!!busy} onClick={() => act({ action: "validate", provider: p.id }, `val-${p.id}`, (res) => (res?.status === "available" ? "Connection test passed." : `Not passing: ${STATUS_LABEL[String(res?.status)] || res?.status}${res?.error ? ` — ${res.error}` : ""}`))} className="min-h-9 rounded-md border border-border px-3 text-xs font-semibold disabled:opacity-40">Re-test</button>}
          {p.keyHint && <button type="button" disabled={!!busy} onClick={() => { if (window.confirm(`Remove the saved ${p.name} key from this Mac's Keychain? The provider will be disabled.`)) act({ action: "key-remove", provider: p.id }, `rm-${p.id}`, () => "Key removed and provider disabled."); }} className="min-h-9 rounded-md border border-red-500/40 px-3 text-xs font-semibold text-red-600 dark:text-red-400 disabled:opacity-40">Remove key</button>}
        </li>
        <li className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-faint">{p.needsAccountId ? 4 : 3}</span>
          <label className="text-xs text-muted" htmlFor={`model-${p.id}`}>Model</label>
          <select id={`model-${p.id}`} value={p.model || ""} disabled={!!busy} onChange={(e) => act({ action: "model", provider: p.id, model: e.target.value }, `model-${p.id}`, () => "Model saved. Re-test to confirm it works with your key.")}
            className="min-h-9 rounded-md border border-border bg-surface px-2 text-xs">
            {(p.models || []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </li>
        <li className="flex flex-wrap items-start gap-2"><span className="text-xs font-bold text-faint">{p.needsAccountId ? 5 : 4}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{p.billingNote}</p>
            <div className="mt-1 flex flex-wrap gap-3">{link(p.pricingUrl, "Official pricing & limits")}{link(p.usageUrl, "Billing & usage settings")}</div>
            <p className="mt-1 text-xs text-muted">
              Usage: {p.usage ? Object.entries(p.usage).filter(([, v]) => v !== null).map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`).join(" · ") || "Usage unavailable" : "Usage unavailable"}
              {p.rate ? ` · rate limit: ${Object.entries(p.rate).filter(([, v]) => v).map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`).join(" · ")}` : ""}
            </p>
            <label className="mt-2 flex items-start gap-2 text-xs text-foreground">
              <input type="checkbox" checked={ack} disabled={!!busy} className="mt-0.5 accent-[#EC5E27]"
                onChange={(e) => { if (e.target.checked && !window.confirm(`${p.name}'s billing for your account is not verified. Calls may use paid credits depending on your plan there. Allow Aarka Tech to use it?`)) return; act({ action: "ack-billing", provider: p.id, ack: e.target.checked }, `ack-${p.id}`, () => (e.target.checked ? "Possible charges acknowledged. You can now enable it." : "Acknowledgement removed; provider disabled.")); }} />
              I understand this provider may charge my account and allow Aarka Tech to use it when enabled.
            </label>
          </div>
        </li>
      </ol>
      <p className="mt-3 text-xs text-faint">Keys are stored in this Mac&apos;s login Keychain (service &quot;arka-tech-ai&quot;), never in files, logs or this page. Enable the provider in the table once the test passes.</p>
      {msg}
    </div>
  );
}
