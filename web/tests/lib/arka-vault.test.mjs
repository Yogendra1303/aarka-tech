import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arka-vault-"));
process.env.ARKA_VAULT_DIR = dir;
process.env.ARKA_VAULT_TEST_KEY = crypto.randomBytes(32).toString("hex");
const v = await import("../../src/lib/arka/vault.ts");

test("records are encrypted at rest and round-trip", () => {
  const secret = Buffer.from("PAN ABCDE1234F payslip net 1,23,456");
  const it = v.addRecord("pan-card.pdf", secret, { category: "Identity (Aadhaar, PAN, passport)", label: "PAN card", docDate: "2026-04" });
  for (const f of fs.readdirSync(dir)) {
    const raw = fs.readFileSync(path.join(dir, f));
    assert.equal(raw.includes("ABCDE1234F"), false, `${f} holds plaintext`);
    assert.equal(raw.includes("PAN card"), false, `${f} leaks the label`);
    assert.equal((fs.statSync(path.join(dir, f)).mode & 0o077), 0, `${f} is readable by others`);
  }
  assert.deepEqual(v.readRecord(it.id).bytes, secret);
  assert.equal(v.vaultStatus().items[0].label, "PAN card");
});

test("rejects bad input and deletes cleanly", () => {
  assert.throws(() => v.addRecord("x.exe", Buffer.from("a"), {}), /PDF/);
  assert.equal(v.readRecord("../../etc/passwd"), null);
  const it = v.addRecord("slip.png", Buffer.from("img"), { category: "nonsense" });
  assert.equal(it.category, "Other records");
  v.deleteRecord(it.id);
  assert.equal(fs.existsSync(path.join(dir, `${it.id}.enc`)), false);
  assert.equal(v.vaultStatus().items.some((x) => x.id === it.id), false);
});

test("a wrong key cannot read the index", () => {
  process.env.ARKA_VAULT_TEST_KEY = crypto.randomBytes(32).toString("hex");
  assert.throws(() => v.vaultStatus());
});
