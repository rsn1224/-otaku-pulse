import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, test } from 'vitest';
import { DEFAULT_ANTHROPIC_MODEL } from './anthropic.ts';
import { getLlmSettings, setAnthropicModel, setProvider } from './settings.ts';

// upsertSetting が必要とする最小の settings テーブルを持つ in-memory DB。
function memDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(
    `CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
  return db;
}

describe('setProvider (VALID_PROVIDERS 検証)', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = memDb();
  });

  test('anthropic を受理して state に反映', () => {
    setProvider(db, 'anthropic');
    expect(getLlmSettings().provider).toBe('anthropic');
  });

  test('perplexity_sonar / ollama を受理', () => {
    setProvider(db, 'perplexity_sonar');
    expect(getLlmSettings().provider).toBe('perplexity_sonar');
    setProvider(db, 'ollama');
    expect(getLlmSettings().provider).toBe('ollama');
  });

  test('未対応 provider は拒否（DB へ書き込まない）', () => {
    setProvider(db, 'anthropic');
    expect(() => setProvider(db, 'gpt-4')).toThrowError(/未対応の provider/);
    // 直前の有効値が保持される（不正値で上書きされない）
    expect(getLlmSettings().provider).toBe('anthropic');
  });
});

describe('setAnthropicModel (既定フォールバック)', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = memDb();
  });

  test('指定モデルを保存', () => {
    setAnthropicModel(db, 'claude-sonnet-4-6');
    expect(getLlmSettings().anthropicModel).toBe('claude-sonnet-4-6');
  });

  test('空文字は既定モデルに戻す', () => {
    setAnthropicModel(db, 'claude-haiku-4-5');
    setAnthropicModel(db, '');
    expect(getLlmSettings().anthropicModel).toBe(DEFAULT_ANTHROPIC_MODEL);
  });
});
