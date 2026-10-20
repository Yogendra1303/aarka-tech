// API keys live in the macOS login Keychain (service "arka-tech-ai", account =
// provider id). Never written to files, logs or JSON responses. Remove with
// removeSecret() or: security delete-generic-password -s arka-tech-ai -a <provider>
// Tests set ARKA_SECRETS_FILE to use a throwaway file store instead.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SERVICE = 'arka-tech-ai';
const fileStore = () => process.env.ARKA_SECRETS_FILE;
const readFile = () => { try { return JSON.parse(readFileSync(fileStore(), 'utf8')); } catch { return {}; } };

export function getSecret(account) {
  if (fileStore()) return readFile()[account] || null;
  try { return execFileSync('security', ['find-generic-password', '-s', SERVICE, '-a', account, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; }
  catch { return null; }
}
export function setSecret(account, value) {
  if (!/^[\x21-\x7e]{8,512}$/.test(value)) throw new Error('key must be 8–512 printable characters with no spaces');
  if (fileStore()) { const s = readFile(); s[account] = value; writeFileSync(fileStore(), JSON.stringify(s), { mode: 0o600 }); return; }
  // -U updates an existing item. The value is passed as an argument to the local
  // `security` tool only (never logged); macOS has no stdin mode for -w.
  execFileSync('security', ['add-generic-password', '-U', '-s', SERVICE, '-a', account, '-l', `Arka Tech AI key (${account})`, '-w', value], { stdio: 'ignore' });
}
export function removeSecret(account) {
  if (fileStore()) { const s = readFile(); delete s[account]; writeFileSync(fileStore(), JSON.stringify(s), { mode: 0o600 }); return; }
  try { execFileSync('security', ['delete-generic-password', '-s', SERVICE, '-a', account], { stdio: 'ignore' }); } catch { /* not present */ }
}
export const hasSecret = (account) => !!getSecret(account);
export const maskKey = (k) => (k ? `••••${k.slice(-4)}` : null);
export const _fileStoreExists = () => !!fileStore() && existsSync(fileStore());
