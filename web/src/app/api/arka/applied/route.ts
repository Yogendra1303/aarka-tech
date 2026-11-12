import { NextResponse } from "next/server";
import { markApplied } from "@/lib/arka/applied";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJsonObject<Record<string, string>>(req);
  if (!body) return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  try { return NextResponse.json(await markApplied(body)); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
