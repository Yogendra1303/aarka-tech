import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { automationDir } from "@/lib/arka/automation";
import { careerOpsRoot } from "@/lib/career-ops";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Gmail (drafts only) via <automation dir>/gmail/gmail.mjs. The OAuth
// consent happens in Google's own page in the user's browser; tokens stay in
// ~/Library/Application Support/careerops and are never returned here.
const DIR = path.join(os.homedir(), "Library", "Application Support", "careerops");
const script = () => path.join(automationDir(), "gmail", "gmail.mjs");
const run = (args: string[], timeout = 60_000): Promise<{ ok: boolean; out: string; err: string }> =>
  new Promise((resolve) => execFile(process.execPath, [script(), ...args], { timeout }, (e, out, err) => resolve({ ok: !e, out: String(out), err: String(err || e?.message || "") })));

export async function GET() {
  const clientConfigured = fs.existsSync(path.join(DIR, "gmail-client.json"));
  const tokenSaved = fs.existsSync(path.join(DIR, "gmail-token.json"));
  let account: string | null = null; let error: string | null = null;
  if (tokenSaved) {
    const r = await run(["status"]);
    try { account = JSON.parse(r.out).emailAddress; } catch { error = r.err.replace(/^gmail: /, "").slice(0, 300) || "status check failed"; }
  }
  return NextResponse.json({ clientConfigured, connected: !!account, account, error, mode: "draft-only", scope: "gmail.compose" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if ((req.headers.get("content-type") || "").startsWith("multipart/form-data")) {
    // The OAuth client file downloaded from Google Cloud. Checked for shape, saved owner-only, never echoed back.
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || file.size > 64 * 1024) return NextResponse.json({ error: "Choose the JSON file Google gave you." }, { status: 400 });
    let j: { installed?: { client_id?: string; client_secret?: string } };
    try { j = JSON.parse(await file.text()); } catch { return NextResponse.json({ error: "That file is not JSON." }, { status: 400 }); }
    if (!j?.installed?.client_id || !j.installed.client_secret) return NextResponse.json({ error: "That is not a Desktop-app OAuth client file. In Google Cloud, create the client as type Desktop app and download its JSON." }, { status: 400 });
    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(DIR, "gmail-client.json"), JSON.stringify(j), { mode: 0o600 });
    return NextResponse.json({ ok: true, note: "Google client saved on this Mac. Now press Connect Gmail account." });
  }
  const body = await readJsonObject<{ action?: string }>(req);
  if (!body) return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  if (body.action === "connect") {
    if (!fs.existsSync(path.join(DIR, "gmail-client.json"))) return NextResponse.json({ error: "Add the Google OAuth client file first (see the steps)." }, { status: 409 });
    // Detached: opens Google's consent page in the default browser and waits for the redirect.
    const child = spawn(process.execPath, [script(), "auth"], { detached: true, stdio: "ignore" });
    child.unref();
    return NextResponse.json({ started: true, note: "Google's consent page opened in your browser. Approve it, then press Refresh." });
  }
  if (body.action === "disconnect") { const r = await run(["disconnect"]); return NextResponse.json({ ok: r.ok, note: r.out.trim() || r.err }); }
  if (body.action === "test-draft") {
    const st = await (await GET()).json();
    if (!st.connected) return NextResponse.json({ error: "Connect Gmail first." }, { status: 409 });
    const bodyFile = path.join(os.tmpdir(), `arka-test-draft-${Date.now()}.txt`);
    fs.writeFileSync(bodyFile, "This is a test draft created by Aarka Tech to confirm Gmail draft creation and attachments. It was not sent.\n");
    const masterDir = path.join(careerOpsRoot(), "output", "master");
    const master = fs.existsSync(masterDir) ? fs.readdirSync(masterDir).find((f) => /^cv-.*-master\.pdf$/.test(f)) : undefined;
    const pdf = master ? path.join(masterDir, master) : "";
    const args = ["draft", "--to", st.account, "--subject", "Aarka Tech test draft (not sent)", "--body-file", bodyFile];
    if (pdf && fs.existsSync(pdf)) args.push("--attach", pdf);
    const r = await run(args, 90_000);
    fs.rmSync(bodyFile, { force: true });
    try { return NextResponse.json({ ok: true, draft: JSON.parse(r.out) }); }
    catch { return NextResponse.json({ error: r.err.replace(/^gmail: /, "").slice(0, 300) || "draft failed" }, { status: 502 }); }
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
