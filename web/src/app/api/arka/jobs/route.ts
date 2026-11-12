import { NextResponse } from "next/server";
import { analyzeUrl, draftFromText, readSaved, removeSaved, saveJob, trackedFor } from "@/lib/arka/job-intake";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET() {
  const jobs = readSaved().map((j) => ({ ...j, description: undefined, tracked: trackedFor(j) }));
  return NextResponse.json({ jobs }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await readJsonObject<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  try {
    if (body.action === "analyze") return NextResponse.json(await analyzeUrl(String(body.url || "")));
    if (body.action === "paste") return NextResponse.json(draftFromText(body as never));
    if (body.action === "save") return NextResponse.json({ job: await saveJob(body.draft as never) });
    if (body.action === "remove") { removeSaved(String(body.id)); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
