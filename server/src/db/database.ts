import { DatabaseSync } from 'node:sqlite';
import { dbPath } from '../config/paths.ts';
import { runMigrations } from './migrate.ts';

/**
 * SQLite を開き、WAL/busy_timeout/外部キーを設定し、未適用 migration を適用する。
 * `node:sqlite`（Node24 組込み）を使用。native 依存ゼロ。
 */
export function openDatabase(path: string = dbPath()): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');

  const { applied } = runMigrations(db);
  if (applied.length > 0) {
    console.log(`[db] migrations applied: ${applied.join(', ')}`);
  }
  return db;
}
