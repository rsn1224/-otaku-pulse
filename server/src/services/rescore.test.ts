import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, test } from 'vitest';
import { get } from '../db/query.ts';
import { rescoreArticles } from './rescore.ts';

interface ScoreRow {
  base_score: number;
  personal_score: number;
  total_score: number;
}

// rescore が必要とする最小テーブル (articles / article_interactions / article_scores)。
function memDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      importance_score REAL NOT NULL DEFAULT 0.0,
      impact_level TEXT,
      is_duplicate INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE article_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE article_scores (
      article_id INTEGER PRIMARY KEY,
      base_score REAL NOT NULL DEFAULT 0.0,
      personal_score REAL NOT NULL DEFAULT 0.0,
      total_score REAL NOT NULL DEFAULT 0.0,
      scored_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function insertArticle(db: DatabaseSync, importance: number, impact: string, dup = 0): number {
  db.prepare(
    'INSERT INTO articles (importance_score, impact_level, is_duplicate) VALUES (?, ?, ?)',
  ).run(importance, impact, dup);
  return Number(get<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')?.id);
}

function interact(db: DatabaseSync, articleId: number, action: string): void {
  db.prepare('INSERT INTO article_interactions (article_id, action) VALUES (?, ?)').run(
    articleId,
    action,
  );
}

function scoreOf(db: DatabaseSync, articleId: number): ScoreRow | undefined {
  return get<ScoreRow>(
    db,
    'SELECT base_score, personal_score, total_score FROM article_scores WHERE article_id = ?',
    articleId,
  );
}

describe('rescoreArticles (ADR-6 unified scoring)', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = memDb();
  });

  test('非重複の全記事を採点し件数を返す (重複は除外)', () => {
    insertArticle(db, 0.5, 'general'); // a1
    insertArticle(db, 0.5, 'general'); // a2
    insertArticle(db, 0.5, 'general', 1); // a3: duplicate → 除外
    const n = rescoreArticles(db);
    expect(n).toBe(2);
    expect(get<{ c: number }>(db, 'SELECT COUNT(*) c FROM article_scores')?.c).toBe(2);
  });

  test('engagement のある記事は personal/total が上がる', () => {
    const a1 = insertArticle(db, 0.5, 'general');
    const a2 = insertArticle(db, 0.5, 'general');
    interact(db, a2, 'bookmark');
    interact(db, a2, 'deepdive');
    rescoreArticles(db);
    const s1 = scoreOf(db, a1);
    const s2 = scoreOf(db, a2);
    expect(s1?.personal_score).toBe(0);
    expect(s2?.personal_score).toBeGreaterThan(0);
    expect(s2?.total_score).toBeGreaterThan(s1?.total_score ?? 0);
  });

  test('confirmed impact は total を押し上げる', () => {
    const a1 = insertArticle(db, 0.5, 'general');
    const a2 = insertArticle(db, 0.5, 'confirmed');
    rescoreArticles(db);
    expect(scoreOf(db, a2)?.total_score).toBeGreaterThan(scoreOf(db, a1)?.total_score ?? 0);
  });

  test('再実行は idempotent (件数・値が安定)', () => {
    const a1 = insertArticle(db, 0.5, 'general');
    interact(db, a1, 'open');
    rescoreArticles(db);
    const first = scoreOf(db, a1);
    const n = rescoreArticles(db);
    const second = scoreOf(db, a1);
    expect(n).toBe(1);
    expect(get<{ c: number }>(db, 'SELECT COUNT(*) c FROM article_scores')?.c).toBe(1);
    expect(second?.total_score).toBeCloseTo(first?.total_score ?? 0, 10);
  });

  test('新規 interaction 後の再 rescore で personal が増える', () => {
    const a1 = insertArticle(db, 0.5, 'general');
    rescoreArticles(db);
    const before = scoreOf(db, a1)?.personal_score ?? 0;
    interact(db, a1, 'bookmark');
    rescoreArticles(db);
    const after = scoreOf(db, a1)?.personal_score ?? 0;
    expect(after).toBeGreaterThan(before);
  });

  test('impact_level が NULL の記事も general として採点される', () => {
    db.prepare('INSERT INTO articles (importance_score, impact_level) VALUES (0.4, NULL)').run();
    const n = rescoreArticles(db);
    expect(n).toBe(1);
    const row = get<ScoreRow>(
      db,
      'SELECT base_score, personal_score, total_score FROM article_scores',
    );
    expect(row?.base_score).toBeCloseTo(0.4, 5);
  });
});
