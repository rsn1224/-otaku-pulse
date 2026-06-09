import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './database.ts';
import { all, get, run } from './query.ts';

interface NameRow {
  name: string;
}
interface CountRow {
  c: number;
}

// 使い捨てDBに全 migration を適用し、スキーマが成立するか検証する。
const p = join(tmpdir(), `otaku_smoke_${process.pid}.db`);
const db = openDatabase(p);

const tables = all<NameRow>(
  db,
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
).map((t) => t.name);
console.log(`tables (${tables.length}): ${tables.join(', ')}`);

for (const t of [
  'articles',
  'feeds',
  'digests',
  'settings',
  'deepdive_cache',
  'daily_highlights',
]) {
  try {
    const r = get<CountRow>(db, `SELECT count(*) c FROM ${t}`);
    console.log(`  ${t}: OK (${r?.c ?? 0} rows)`);
  } catch (e) {
    console.log(`  ${t}: MISSING — ${(e as Error).message}`);
  }
}

run(
  db,
  'INSERT INTO articles (feed_id, external_id, title, url) VALUES (1, ?, ?, ?)',
  'smoke-1',
  'ガンダム新作発表',
  'https://example.com/a',
);
const hit = all<{ rowid: number }>(
  db,
  "SELECT rowid FROM articles_fts WHERE articles_fts MATCH 'ガンダム新作発表'",
);
console.log(`FTS5 MATCH (full-token): ${hit.length} hit`);

db.close();
console.log('SMOKE OK');
