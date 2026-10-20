import { NextResponse } from "next/server";
import { readProfile, updatePreferences } from "@/lib/arka/profile";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(readProfile(), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return NextResponse.json({ error: `Profile unavailable: ${(e as Error).message}` }, { status: 500 }); }
}

export async function POST(req: Request) {
  const body = await readJsonObject<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  try { const r = updatePreferences(body); return NextResponse.json({ ...r, profile: readProfile() }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
