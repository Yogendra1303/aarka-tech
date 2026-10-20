// Offline tests for the Gmail connector: no network, no Google account. Gmail is mocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const secrets = mkdtempSync(join(tmpdir(), 'gm-'));
process.env.CAREEROPS_SECRETS_DIR = secrets;
writeFileSync(join(secrets, 'gmail-client.json'), JSON.stringify({ installed: { client_id: 'test-client' } }));
writeFileSync(join(secrets, 'gmail-token.json'), JSON.stringify({ refresh_token: 'r', access_token: 'a', expires_at: Date.now() + 3600e3 }));
const { checkAttachment, buildMime, createDraft, SCOPE } = await import('../../automation/gmail/gmail.mjs');
const realPdf = new URL('../../automation/tests/fixtures/sample.pdf', import.meta.url).pathname;

test('only the compose scope is requested', () => assert.equal(SCOPE, 'https://www.googleapis.com/auth/gmail.compose'));
test('a real resume PDF passes the attachment check', () => assert.equal(checkAttachment(realPdf).ok, true));
test('missing, empty, fake-PDF and disallowed files are rejected', () => {
  const d = mkdtempSync(join(tmpdir(), 'att-'));
  writeFileSync(join(d, 'empty.pdf'), '');
  writeFileSync(join(d, 'fake.pdf'), 'hello');
  writeFileSync(join(d, 'run.sh'), 'echo');
  assert.equal(checkAttachment(join(d, 'nope.pdf')).ok, false);
  assert.equal(checkAttachment(join(d, 'empty.pdf')).ok, false);
  assert.equal(checkAttachment(join(d, 'fake.pdf')).ok, false);
  assert.equal(checkAttachment(join(d, 'run.sh')).ok, false);
});
test('MIME carries recipient, subject and the attachment name', () => {
  const m = buildMime({ to: 'r@example.com', subject: 'Head of Operations', body: 'Hi', attachments: [checkAttachment(realPdf)] });
  assert.match(m, /To: r@example.com/); assert.match(m, /Subject: Head of Operations/);
  assert.match(m, /filename="sample.pdf"/); assert.match(m, /multipart\/mixed/);
});
test('createDraft posts to drafts, verifies it, and never calls send', async () => {
  const calls = [];
  const fake = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET' });
    if (url.endsWith('/drafts') && opts.method === 'POST') return { ok: true, json: async () => ({ id: 'd1', message: { id: 'm1' } }) };
    if (url.includes('/drafts/d1')) return { ok: true, json: async () => ({ message: { payload: { headers: [{ name: 'To', value: 'r@example.com' }] } } }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const rec = await createDraft({ to: 'r@example.com', subject: 'S', body: 'B', attachPaths: [realPdf] }, fake);
  assert.equal(rec.draft_id, 'd1');
  assert.ok(calls.every((c) => !/\/send/.test(c.url)), 'no send endpoint used');
});
test('a bad attachment stops the draft before any Gmail call', async () => {
  let called = false;
  await assert.rejects(createDraft({ to: 'r@example.com', subject: 'S', body: 'B', attachPaths: ['/nope.pdf'] }, async () => { called = true; }));
  assert.equal(called, false);
});
test('an unverifiable draft is reported as a failure', async () => {
  const fake = async (url, opts = {}) => (opts.method === 'POST' ? { ok: true, json: async () => ({ id: 'd2', message: { id: 'm2' } }) } : { ok: true, json: async () => ({ message: { payload: { headers: [] } } }) });
  await assert.rejects(createDraft({ to: 'r@example.com', subject: 'S', body: 'B' }, fake), /could not be verified/);
});
