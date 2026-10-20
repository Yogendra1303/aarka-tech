import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Personal records vault (Aadhaar, PAN, salary slips, offer and relieving letters…).
// Files and their index are encrypted with AES-256-GCM; the key lives only in the macOS
// Keychain. The folder sits outside the Career-ops checkout, so nothing here can reach git,
// a generated application pack, or any AI provider. Nothing in this module logs names or contents.

export const VAULT_CATEGORIES = [
  "Identity (Aadhaar, PAN, passport)", "Salary slips", "Offer letters", "Relieving & experience letters",
  "Appraisal & increment letters", "Tax (Form 16, ITR)", "Bank, PF & UAN", "Education certificates", "Other records",
] as const;

const SERVICE = "arka-tech-vault";
const ACCOUNT = "vault-key";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["pdf", "png", "jpg", "jpeg", "webp", "heic", "doc", "docx", "xls", "xlsx", "txt"]);

export type VaultItem = { id: string; name: string; category: string; label: string; note: string; size: number; ext: string; addedAt: string; docDate: string };

export function vaultDir() {
  return process.env.ARKA_VAULT_DIR || path.join(os.homedir(), "Library", "Application Support", "careerops", "vault");
}

function keychainKey(create: boolean): Buffer | null {
  if (process.env.ARKA_VAULT_TEST_KEY) return Buffer.from(process.env.ARKA_VAULT_TEST_KEY, "hex");
  try {
    const hex = execFileSync("security", ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (/^[0-9a-f]{64}$/.test(hex)) return Buffer.from(hex, "hex");
  } catch { /* not created yet */ }
  if (!create) return null;
  const key = crypto.randomBytes(32);
  execFileSync("security", ["add-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-l", "Aarka Tech records vault", "-U", "-w", key.toString("hex")], { stdio: "ignore" });
  return key;
}

function seal(key: Buffer, plain: Buffer) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([Buffer.from("AV1"), iv, c.getAuthTag(), body]);
}
function open(key: Buffer, blob: Buffer) {
  if (blob.subarray(0, 3).toString() !== "AV1") throw new Error("Unrecognised vault file.");
  const d = crypto.createDecipheriv("aes-256-gcm", key, blob.subarray(3, 15));
  d.setAuthTag(blob.subarray(15, 31));
  return Buffer.concat([d.update(blob.subarray(31)), d.final()]);
}

function ensureDir() { fs.mkdirSync(vaultDir(), { recursive: true, mode: 0o700 }); fs.chmodSync(vaultDir(), 0o700); }
const indexFile = () => path.join(vaultDir(), "index.enc");
const write = (p: string, b: Buffer) => { const tmp = `${p}.tmp`; fs.writeFileSync(tmp, b, { mode: 0o600 }); fs.renameSync(tmp, p); };

function readIndex(key: Buffer): VaultItem[] {
  if (!fs.existsSync(indexFile())) return [];
  return JSON.parse(open(key, fs.readFileSync(indexFile())).toString("utf8"));
}
function writeIndex(key: Buffer, items: VaultItem[]) { write(indexFile(), seal(key, Buffer.from(JSON.stringify(items)))); }

export function vaultStatus() {
  const key = keychainKey(false);
  if (!key) return { ready: false, items: [] as VaultItem[], categories: VAULT_CATEGORIES };
  return { ready: true, items: readIndex(key).sort((a, b) => b.addedAt.localeCompare(a.addedAt)), categories: VAULT_CATEGORIES };
}

const clean = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

export function addRecord(fileName: string, bytes: Buffer, meta: { category?: string; label?: string; note?: string; docDate?: string }) {
  if (!bytes.length) throw new Error("The file is empty.");
  if (bytes.length > MAX_BYTES) throw new Error("Files up to 10 MB can be stored.");
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (!ALLOWED.has(ext)) throw new Error("Use PDF, image, Word, Excel or text files.");
  const category = (VAULT_CATEGORIES as readonly string[]).includes(String(meta.category)) ? String(meta.category) : "Other records";
  const docDate = /^\d{4}-\d{2}(-\d{2})?$/.test(String(meta.docDate || "")) ? String(meta.docDate) : "";
  ensureDir();
  const key = keychainKey(true)!;
  const id = crypto.randomBytes(9).toString("hex");
  write(path.join(vaultDir(), `${id}.enc`), seal(key, bytes));
  const item: VaultItem = { id, name: clean(path.basename(fileName), 160), category, label: clean(meta.label, 120) || clean(path.basename(fileName, `.${ext}`), 120), note: clean(meta.note, 400), size: bytes.length, ext, addedAt: new Date().toISOString(), docDate };
  writeIndex(key, [...readIndex(key), item]);
  return item;
}

export function updateRecord(id: string, patch: { category?: string; label?: string; note?: string; docDate?: string }) {
  const key = keychainKey(false); if (!key) throw new Error("Vault is empty.");
  const items = readIndex(key);
  const it = items.find((x) => x.id === id); if (!it) throw new Error("Record not found.");
  if (patch.label !== undefined) it.label = clean(patch.label, 120) || it.label;
  if (patch.note !== undefined) it.note = clean(patch.note, 400);
  if (patch.category !== undefined && (VAULT_CATEGORIES as readonly string[]).includes(patch.category)) it.category = patch.category;
  if (patch.docDate !== undefined) it.docDate = /^\d{4}-\d{2}(-\d{2})?$/.test(patch.docDate) ? patch.docDate : "";
  writeIndex(key, items);
  return it;
}

export function readRecord(id: string) {
  if (!/^[0-9a-f]{18}$/.test(id)) return null;
  const key = keychainKey(false); if (!key) return null;
  const it = readIndex(key).find((x) => x.id === id); if (!it) return null;
  return { item: it, bytes: open(key, fs.readFileSync(path.join(vaultDir(), `${id}.enc`))) };
}

// Removes the record and its encrypted file from disk (the person confirms in the UI first).
export function deleteRecord(id: string) {
  const key = keychainKey(false); if (!key) throw new Error("Vault is empty.");
  const items = readIndex(key);
  if (!items.some((x) => x.id === id)) throw new Error("Record not found.");
  writeIndex(key, items.filter((x) => x.id !== id));
  fs.rmSync(path.join(vaultDir(), `${id}.enc`), { force: true });
}
