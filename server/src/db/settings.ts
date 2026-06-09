import type { DatabaseSync } from 'node:sqlite';
import { invalidInput } from '../error.ts';
import { all, run } from './query.ts';

const MAX_KEY_LENGTH = 100;
const MAX_VALUE_LENGTH = 10_000;

export function loadSettings(db: DatabaseSync): Record<string, string> {
  const rows = all<{ key: string; value: string }>(db, 'SELECT key, value FROM settings');
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function upsertSetting(db: DatabaseSync, key: string, value: string): void {
  const k = key.trim();
  if (k === '' || k.length > MAX_KEY_LENGTH) {
    throw invalidInput(`設定キーは1〜${MAX_KEY_LENGTH}文字で入力してください`);
  }
  if (value.length > MAX_VALUE_LENGTH) {
    throw invalidInput(`設定値が長すぎます（最大${MAX_VALUE_LENGTH}文字）`);
  }
  run(
    db,
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    k,
    value,
  );
}
