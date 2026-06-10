import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  getCollectionMetrics,
  getLlmByModel,
  getLlmByTask,
  getLlmTotals,
  initMetrics,
  recordLlmCall,
} from './metrics.ts';

function memDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE llm_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL, model TEXT NOT NULL, task TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE feeds (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL);
    CREATE TABLE articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_id INTEGER NOT NULL,
      is_duplicate INTEGER NOT NULL DEFAULT 0
    );
  `);
  return db;
}

describe('LLM metrics (record + 集計)', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = memDb();
    initMetrics(db);
  });

  test('recordLlmCall が totals に集計される', () => {
    recordLlmCall({
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      task: 'digest',
      promptTokens: 100,
      completionTokens: 200,
      latencyMs: 1000,
      costUsd: 0.0165,
    });
    recordLlmCall({
      provider: 'ollama',
      model: 'qwen3:14b',
      task: 'summary',
      promptTokens: 50,
      completionTokens: 80,
      latencyMs: 500,
      costUsd: 0,
    });
    const t = getLlmTotals(db);
    expect(t.calls).toBe(2);
    expect(t.promptTokens).toBe(150);
    expect(t.completionTokens).toBe(280);
    expect(t.costUsd).toBeCloseTo(0.0165, 6);
    expect(t.avgLatencyMs).toBe(750);
  });

  test('byModel は cost 降順、byTask は呼出単位で集計', () => {
    recordLlmCall({
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      task: 'digest',
      promptTokens: 1,
      completionTokens: 1,
      latencyMs: 10,
      costUsd: 0.5,
    });
    recordLlmCall({
      provider: 'ollama',
      model: 'qwen3:14b',
      task: 'digest',
      promptTokens: 1,
      completionTokens: 1,
      latencyMs: 30,
      costUsd: 0,
    });
    const byModel = getLlmByModel(db);
    expect(byModel).toHaveLength(2);
    expect(byModel[0]?.model).toBe('claude-opus-4-8'); // cost 降順
    const byTask = getLlmByTask(db);
    expect(byTask).toHaveLength(1);
    expect(byTask[0]?.task).toBe('digest');
    expect(byTask[0]?.calls).toBe(2);
  });

  test('initMetrics 未設定では record は no-op（別 db には書かれない）', () => {
    initMetrics(memDb()); // sink を別 db に向ける
    recordLlmCall({
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      task: 'digest',
      promptTokens: 1,
      completionTokens: 1,
      latencyMs: 1,
      costUsd: 1,
    });
    expect(getLlmTotals(db).calls).toBe(0); // 元の db には書かれていない
  });
});

describe('collection metrics (pipeline)', () => {
  test('総数・dedup 率・カテゴリ別件数', () => {
    const db = memDb();
    db.prepare('INSERT INTO feeds (category) VALUES (?)').run('anime');
    db.prepare('INSERT INTO feeds (category) VALUES (?)').run('game');
    // anime: 2 件（うち 1 件 dup）, game: 1 件
    db.prepare('INSERT INTO articles (feed_id, is_duplicate) VALUES (1, 0)').run();
    db.prepare('INSERT INTO articles (feed_id, is_duplicate) VALUES (1, 1)').run();
    db.prepare('INSERT INTO articles (feed_id, is_duplicate) VALUES (2, 0)').run();
    const m = getCollectionMetrics(db);
    expect(m.totalArticles).toBe(3);
    expect(m.duplicates).toBe(1);
    expect(m.dedupRate).toBeCloseTo(1 / 3, 6);
    // byCategory は非重複のみ: anime 1, game 1
    const anime = m.byCategory.find((c) => c.category === 'anime');
    expect(anime?.count).toBe(1);
    expect(m.byCategory.find((c) => c.category === 'game')?.count).toBe(1);
  });
});
