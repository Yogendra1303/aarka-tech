import { NextResponse } from "next/server";
import { addRecord, deleteRecord, readRecord, updateRecord, vaultStatus } from "@/lib/arka/vault";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
const TYPES: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const id = sp.get("id");
  try {
    if (!id) return NextResponse.json(vaultStatus(), { headers: NO_STORE });
    const r = readRecord(id);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    const inline = sp.get("download") !== "1" && r.item.ext in TYPES;
    const fname = `${r.item.label.replace(/[^\w .-]+/g, "_")}.${r.item.ext}`;
    return new Response(new Uint8Array(r.bytes), { headers: { ...NO_STORE, "Content-Type": TYPES[r.item.ext] || "application/octet-stream", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fname}"` } });
  } catch { return NextResponse.json({ error: "The vault could not be opened. Check that Keychain access is allowed." }, { status: 500, headers: NO_STORE }); }
}

export async function POST(req: Request) {
  try {
    if ((req.headers.get("content-type") || "").startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });
      const item = addRecord(file.name, Buffer.from(await file.arrayBuffer()), { category: String(form.get("category") || ""), label: String(form.get("label") || ""), note: String(form.get("note") || ""), docDate: String(form.get("docDate") || "") });
      return NextResponse.json({ item }, { headers: NO_STORE });
    }
    const body = await readJsonObject<Record<string, unknown>>(req);
    if (!body) return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
    if (body.action === "update") return NextResponse.json({ item: updateRecord(String(body.id), body.patch as Record<string, string>) }, { headers: NO_STORE });
    if (body.action === "delete") { deleteRecord(String(body.id)); return NextResponse.json({ ok: true }, { headers: NO_STORE }); }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: NO_STORE }); }
}
