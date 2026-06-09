import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** アプリのデータディレクトリ（Tauri の app_data_dir 置換）。 */
export function appDataDir(): string {
  const base = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
  const dir = join(base, 'OtakuPulse');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** SQLite データベースファイルのパス。 */
export function dbPath(): string {
  return join(appDataDir(), 'otaku_pulse.db');
}
