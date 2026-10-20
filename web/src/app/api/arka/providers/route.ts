import { execFile } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { automationDir } from "@/lib/arka/automation";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Thin wrapper over automation/ai-engine/cli.mjs (the single source
// of truth for providers). API keys travel to the engine on stdin and are stored
// in the macOS Keychain; no response ever contains a key.
const IDS = new Set(["claude", "codex", "antigravity", "gemini", "qwen", "hermes", "gemini_api", "groq", "mistral", "openrouter", "cloudflare"]);

function cli(args: string[], { timeout = 30_000, input }: { timeout?: number; input?: string } = {}): Promise<{ ok: boolean; json: unknown; error?: string }> {
  const script = path.join(automationDir(), "ai-engine", "cli.mjs");
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [script, ...args], { timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      let json: unknown = null;
      try { json = JSON.parse(stdout); } catch { /* not JSON */ }
      resolve({ ok: !err && json !== null, json, error: err ? (stderr || err.message).trim().slice(0, 400) : undefined });
    });
    child.stdin?.end(input ?? "");
  });
}

export async function GET() {
  // Status probes every CLI (version, sign-in); on a busy machine that can pass 30s.
  const r = await cli(["status"], { timeout: 90_000 });
  return r.json ? NextResponse.json(r.json, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: r.error }, { status: 500 });
}

type Body = { action?: string; provider?: string; enabled?: boolean; order?: string[]; key?: string; model?: string; accountId?: string; ack?: boolean };

export async function POST(req: Request) {
  const body = await readJsonObject<Body>(req);
  if (!body) return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  const id = body.provider && IDS.has(body.provider) ? body.provider : null;
  let r;
  switch (body.action) {
    case "set": if (!id) break; r = await cli(["set", id, body.enabled ? "on" : "off"]); break;
    case "order": if (!Array.isArray(body.order) || !body.order.every((x) => IDS.has(x))) break; r = await cli(["order", body.order.join(",")]); break;
    case "pause": case "resume": r = await cli([body.action]); break;
    case "test": if (!id) break; r = await cli(["test", id], { timeout: 240_000 }); break;
    case "validate": if (!id) break; r = await cli(["validate", id], { timeout: 60_000 }); break;
    case "key-save": {
      if (!id || typeof body.key !== "string" || !body.key.trim()) break;
      const saved = await cli(["key-save", id], { input: body.key.trim() });
      if (!saved.ok) { r = saved; break; }
      r = await cli(["validate", id], { timeout: 60_000 }); // Validate & Save
      break;
    }
    case "key-remove": if (!id) break; r = await cli(["key-remove", id]); break;
    case "model": if (!id || typeof body.model !== "string" || !/^[\w@./:-]{2,120}$/.test(body.model)) break; r = await cli(["model", id, body.model]); break;
    case "account": if (id !== "cloudflare" || typeof body.accountId !== "string") break; r = await cli(["account", id, body.accountId.trim()]); break;
    case "ack-billing": if (!id) break; r = await cli(["ack-billing", id, body.ack ? "on" : "off"]); break;
  }
  if (!r) return NextResponse.json({ error: "Unknown or invalid action." }, { status: 400 });
  return NextResponse.json({ ok: r.ok, result: r.json, error: r.error }, { status: r.ok ? 200 : 422 });
}
