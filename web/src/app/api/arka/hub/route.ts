import fs from "node:fs";
import { NextResponse } from "next/server";
import { assetPath, docPath, importGithubRepos, previewGithubRepos, readHub, readIntegrations, refreshGithub, saveAsset, saveLink, saveOriginal, saveOverview, saveProject, updateAsset, updateDoc } from "@/lib/arka/hub";
import { readJsonObject } from "@/lib/json-body";
import { updatePreferences } from "@/lib/arka/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const doc = sp.get("doc") || sp.get("asset");
  if (doc) {
    // Serve one library document or portfolio file inline (preview) or as a download. Registered files only.
    const p = sp.get("asset") ? assetPath(doc) : docPath(doc);
    if (!p || !fs.existsSync(p)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ext = (p.split(".").pop() || "").toLowerCase();
    const types: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
    const inlineOk = ext in types;
    const download = sp.get("download") === "1";
    return new Response(fs.readFileSync(p), { headers: {
      "Content-Type": types[ext] || "application/octet-stream",
      "Content-Disposition": `${download || !inlineOk ? "attachment" : "inline"}; filename="${p.split("/").pop()}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    } });
  }
  try { return NextResponse.json(readHub(), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return NextResponse.json({ error: `Career Hub unavailable: ${(e as Error).message}` }, { status: 500 }); }
}

export async function POST(req: Request) {
  const type = req.headers.get("content-type") || "";
  try {
    if (type.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });
      const bytes = Buffer.from(await file.arrayBuffer());
      if (form.get("kind") === "asset") return NextResponse.json({ asset: saveAsset(file.name, bytes, String(form.get("visibility") || ""), String(form.get("project") || "")) });
      const saved = saveOriginal(file.name, bytes);
      return NextResponse.json({ saved });
    }
    const body = await readJsonObject<Record<string, unknown>>(req);
    if (!body) return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
    if (body.action === "project") return NextResponse.json({ project: saveProject((body.project || {}) as Record<string, unknown>) });
    if (body.action === "overview") { saveOverview(body as { headline?: string; summary?: string }); return NextResponse.json({ ok: true }); }
    if (body.action === "asset") { updateAsset(String(body.id), body.patch as Record<string, never>); return NextResponse.json({ ok: true }); }
    if (body.action === "link") {
      saveLink(String(body.service), String(body.url || ""));
      // One LinkedIn URL: the profile (used on resumes) follows the Connected accounts row.
      if (body.service === "linkedin") updatePreferences({ linkedin: String(readIntegrations().find((i) => i.id === "linkedin")?.url || "").replace(/^https?:\/\/(www\.)?/, "") });
      return NextResponse.json({ ok: true, integrations: readIntegrations() });
    }
    if (body.action === "github-preview") return NextResponse.json({ repos: await previewGithubRepos() });
    if (body.action === "github-import") return NextResponse.json(importGithubRepos((body.repos || []) as never));
    if (body.action === "github-refresh") return NextResponse.json({ sync: await refreshGithub() });
    if (body.action === "doc") { updateDoc(String(body.id), { label: body.label as string | undefined, archived: body.archived as boolean | undefined }); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
