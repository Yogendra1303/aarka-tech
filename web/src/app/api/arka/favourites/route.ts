import { NextResponse } from "next/server";
import { readPrefs, updatePrefs } from "@/lib/arka/favourites";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readPrefs(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await readJsonObject<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  try { return NextResponse.json(updatePrefs(String(body.action), body)); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
