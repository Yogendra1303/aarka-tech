import { NextResponse } from "next/server";
import { readOverview } from "@/lib/arka/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(readOverview(), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return NextResponse.json({ error: `Overview unavailable: ${(e as Error).message}` }, { status: 500 }); }
}
