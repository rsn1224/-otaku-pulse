import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname, userInfo } from 'node:os';
import { join } from 'node:path';
import { appDataDir } from '../config/paths.ts';

// credential_store.rs（OS keyring）の置換。AES-256-GCM の暗号化ローカルファイル。
// 鍵はマシン固有値（username@hostname）から scrypt 派生。native 依存ゼロ。
// 単一ユーザーのローカルアプリ前提（DPAPI 相当の利便性。determined local attacker は対象外）。

export const PERPLEXITY_ACCOUNT = 'perplexity-api-key';
export const RAWG_ACCOUNT = 'rawg-api-key';
export const ANTHROPIC_ACCOUNT = 'anthropic-api-key';

const SALT = 'otaku-pulse-cred-v1';

interface Envelope {
  iv: string;
  tag: string;
  data: string;
}

function credFile(): string {
  return join(appDataDir(), 'credentials.enc');
}

function deriveKey(): Buffer {
  const material = `${userInfo().username}@${hostname()}:otaku-pulse`;
  return scryptSync(material, SALT, 32);
}

function readAll(): Record<string, string> {
  const f = credFile();
  if (!existsSync(f)) return {};
  try {
    const env = JSON.parse(readFileSync(f, 'utf8')) as Envelope;
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(env.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(env.tag, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(env.data, 'base64')), decipher.final()]);
    return JSON.parse(dec.toString('utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, string>): void {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(map), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const env: Envelope = {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  };
  writeFileSync(credFile(), JSON.stringify(env), { mode: 0o600 });
}

export function loadCredential(account: string): string | null {
  return readAll()[account] ?? null;
}

export function storeCredential(account: string, value: string): void {
  const map = readAll();
  map[account] = value;
  writeAll(map);
}

export function deleteCredential(account: string): void {
  const map = readAll();
  delete map[account];
  writeAll(map);
}
