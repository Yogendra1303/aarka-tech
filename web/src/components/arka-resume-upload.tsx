"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { CvIngest } from "@/components/cv/cv-ingest";

const ACCEPT = ".pdf,.docx,.txt,.md";
const MAX = 10 * 1024 * 1024;

// Every "Upload / update resume" button: opens the file picker, keeps the original file in
// Documents, then reads it and lets you review the extracted resume before anything replaces
// your master resume (the previous one is backed up).
export function ResumeUploadButton({ label = "Upload or update resume", className, onDone }: { label?: string; className?: string; onDone?: (msg: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");

  const pick = async (f: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!f || busy) return;
    setErr("");
    if (!/\.(pdf|docx|txt|md)$/i.test(f.name)) { setErr("Choose a PDF, Word (.docx) or text file."); return; }
    if (f.size > MAX) { setErr("That file is larger than 10 MB."); return; }
    if (f.size === 0) { setErr("That file is empty."); return; }
    setBusy(true);
    try {
      if (/\.(pdf|docx)$/i.test(f.name)) {
        // Keep the original exactly as uploaded (new name if one already exists).
        const fd = new FormData(); fd.set("file", f);
        const r = await fetch("/api/arka/hub", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Upload failed.");
      }
      setFile(f);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <span className="inline-flex flex-col items-end gap-1">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className={className}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {busy ? "Uploading…" : label}
        </button>
        <input ref={input} type="file" accept={ACCEPT} className="hidden" aria-label="Resume file" onChange={(e) => void pick(e.target.files?.[0])} />
        {err && <span role="alert" className="text-xs text-red-600 dark:text-red-400">{err}</span>}
      </span>
      {file && (
        <div role="dialog" aria-modal="true" aria-label="Review your resume" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div className="relative mt-8 w-full max-w-3xl rounded-2xl border border-border bg-background p-5 shadow-2xl">
            <div className="mb-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold tracking-tight text-foreground">Review your resume</h2>
                <p className="text-xs text-muted">{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB · {/\.(pdf|docx)$/i.test(file.name) ? "original kept in Documents" : "text file"}. Nothing changes until you save; your current resume is backed up first.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setFile(null)} className="rounded-md p-1 text-muted hover:text-foreground"><X className="size-5" /></button>
            </div>
            <CvIngest initialFile={file} stayAfterSave onSaved={() => { setFile(null); onDone?.("Resume saved. Your profile and dashboard now use it; the previous version was backed up."); }} />
          </div>
        </div>
      )}
    </>
  );
}
