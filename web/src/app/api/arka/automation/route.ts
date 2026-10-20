import { NextResponse } from "next/server";
import { queueFullRun, readAutomationStatus, setPaused } from "@/lib/arka/automation";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readAutomationStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: `Automation status unavailable: ${(error as Error).message}` }, { status: 500 });
  }
}

// Actions: { action: "pause" | "resume" | "queue-full-run" }. Discovery Run Now
// uses the existing /api/scheduled-jobs/[id]/run route directly.
export async function POST(req: Request) {
  const body = await readJsonObject<{ action?: string }>(req);
  if (!body) return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  try {
    if (body.action === "pause") await setPaused(true);
    else if (body.action === "resume") await setPaused(false);
    else if (body.action === "queue-full-run") {
      const status = readAutomationStatus();
      if (status.paused) return NextResponse.json({ error: "Automation is paused. Resume it first." }, { status: 409 });
      if (status.runNowQueued) return NextResponse.json({ error: "A full run is already queued." }, { status: 409 });
      queueFullRun();
    } else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    return NextResponse.json(readAutomationStatus());
  } catch (error) {
    return NextResponse.json({ error: `Action failed: ${(error as Error).message}` }, { status: 500 });
  }
}
