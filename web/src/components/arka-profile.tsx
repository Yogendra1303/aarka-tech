"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleDashed, ExternalLink, Loader2, UserRound } from "lucide-react";

type Check = { id: string; label: string; done: boolean; detail: string; href?: string };
type Profile = {
  name: string; completion: number; checks: Check[];
  preferences: Record<string, string>; openQuestions: { id: string; issue: string; question: string | null }[];
};

// My Career Profile: completion over the real files, an editor for the facts only
// the candidate can supply, and links to the resume (CV) and project records.
export function ArkaProfile() {
  const [p, setP] = useState<Profile | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/arka/profile", { cache: "no-store" });
    const j = await r.json();
    if (r.ok) { setP(j); setForm(j.preferences); } else setMsg({ tone: "err", text: j.error });
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch("/api/arka/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setP(j.profile); setForm(j.profile.preferences);
      setMsg({ tone: "ok", text: j.changed.length ? `Saved: ${j.changed.join(", ").replaceAll("_", " ")}. A backup of your profile was kept.` : "Nothing changed." });
    } catch (e) { setMsg({ tone: "err", text: (e as Error).message }); }
    finally { setSaving(false); }
  };

  const field = (k: string, label: string, placeholder: string, help?: string) => (
    <label className="block text-sm">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <input value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={placeholder}
        className="mt-1 min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-faint focus:border-brand/60" />
      {help ? <span className="mt-0.5 block text-xs text-faint">{help}</span> : null}
    </label>
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 max-sm:px-4 max-sm:pb-24">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">My Career Profile</p>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-[-0.03em] text-foreground"><UserRound className="size-6 text-brand-text" /> {p?.name || "Your profile"}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">One record of your experience, used for job matching, tailored resumes, cover letters and recruiter messages. Edit it once; every application uses it.</p>

      {!p ? <p className="mt-6 flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p> : (
        <>
          <div className="mt-5 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-foreground">Profile completion</span>
              <span className="text-2xl font-extrabold tabular-nums text-brand-text">{p.completion}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hover" role="progressbar" aria-valuenow={p.completion} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand" style={{ width: `${p.completion}%` }} />
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {p.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  {c.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-text" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-faint" />}
                  <span className="min-w-0"><span className="font-semibold text-foreground">{c.label}</span><span className="block break-words text-xs text-muted">{c.detail}</span></span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-bold text-foreground">Details only you can give</h2>
              <p className="mt-0.5 text-xs text-muted">Left blank, these are never guessed. Applications show them as &quot;needs you&quot;.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {field("target_range", "Target salary", "e.g. 45–55 LPA or AED 35,000/month")}
                {field("currency", "Currency", "INR or AED")}
                {field("minimum", "Minimum you would accept", "Optional")}
                {field("notice_period_days", "Notice period (days)", "e.g. 30")}
                {field("visa_status", "UAE work authorization", "e.g. Need employer visa sponsorship")}
                {field("linkedin", "LinkedIn profile URL", "linkedin.com/in/…")}
              </div>
              <button type="button" onClick={save} disabled={saving} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground disabled:opacity-50">
                {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save details
              </button>
              {msg && <p role="status" className={`mt-3 text-sm ${msg.tone === "err" ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{msg.text}</p>}
            </section>

            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-bold text-foreground">Resume, history and projects</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/cv" className="font-semibold text-brand-text hover:underline">Resume (CV)</Link><span className="block text-xs text-muted">Upload a PDF or paste text; you confirm the extracted resume before it is saved.</span></li>
                <li><span className="font-semibold text-foreground">Employment, consulting and projects</span><span className="block text-xs text-muted">Stored with sources in data/career-kb (overlapping consulting allowed; confidential clients flagged).</span></li>
                <li><span className="font-semibold text-foreground">LinkedIn data export (optional)</span><span className="block text-xs text-muted">Download it from LinkedIn → Settings → Data privacy → Get a copy of your data, then drop the files into the Documents folder. Not required for anything else to work.</span>
                  <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-text hover:underline">Open LinkedIn data export <ExternalLink className="size-3" /></a></li>
              </ul>
              {p.openQuestions.length > 0 && (
                <>
                  <h3 className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-faint">To confirm ({p.openQuestions.length})</h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted">
                    {p.openQuestions.map((q) => <li key={q.id}><span className="text-foreground">{q.question || q.issue}</span></li>)}
                  </ul>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
