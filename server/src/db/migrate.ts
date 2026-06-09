import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { all, run } from './query.ts';

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations');

interface MigrationRow {
  version: string;
}

/**
 * `migrations/*.sql` を昇順で適用する。適用済みは `schema_migrations` で追跡。
 * 各ファイルはトランザクションで囲み、失敗時はロールバックして例外を投げる。
 */
export function runMigrations(db: DatabaseSync): { applied: string[] } {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const done = new Set(
    all<MigrationRow>(db, 'SELECT version FROM schema_migrations').map((r) => r.version),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied: string[] = [];

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (done.has(version)) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      run(db, 'INSERT INTO schema_migrations (version) VALUES (?)', version);
      db.exec('COMMIT');
      applied.push(version);
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`migration ${version} failed: ${(e as Error).message}`);
    }
  }

  return { applied };
}
