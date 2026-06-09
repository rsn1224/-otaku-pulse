import { describe, expect, test } from 'vitest';
import { embedPrefix, rankEmbeddings } from './embeddings.ts';

// ADR-7 連携: grounded deepdive の retrieval ランキング（純関数）。

const emb = (articleId: number, vec: number[]): { articleId: number; vec: number[] } => ({
  articleId,
  vec,
});

describe('rankEmbeddings', () => {
  test('cosine 降順でソートされる', () => {
    const ranked = rankEmbeddings(
      [1, 0],
      [emb(1, [0.8, 0.6]), emb(2, [1, 0]), emb(3, [0.6, 0.8])],
      { excludeId: -1, limit: 10, minScore: 0 },
    );
    expect(ranked.map((r) => r.id)).toEqual([2, 1, 3]);
  });

  test('excludeId を除外する', () => {
    const ranked = rankEmbeddings([1, 0], [emb(1, [1, 0]), emb(2, [0.9, 0.1])], {
      excludeId: 1,
      limit: 10,
      minScore: 0,
    });
    expect(ranked.map((r) => r.id)).toEqual([2]);
  });

  test('minScore 未満を除外する', () => {
    const ranked = rankEmbeddings([1, 0], [emb(1, [1, 0]), emb(2, [0, 1])], {
      excludeId: -1,
      limit: 10,
      minScore: 0.5,
    });
    expect(ranked.map((r) => r.id)).toEqual([1]); // id2 は cosine 0 で除外
  });

  test('limit で上位のみ返す', () => {
    const ranked = rankEmbeddings(
      [1, 0],
      [emb(1, [1, 0]), emb(2, [0.9, 0.1]), emb(3, [0.8, 0.2])],
      { excludeId: -1, limit: 2, minScore: 0 },
    );
    expect(ranked).toHaveLength(2);
    expect(ranked.map((r) => r.id)).toEqual([1, 2]);
  });

  test('空集合なら空配列', () => {
    expect(rankEmbeddings([1, 0], [], { excludeId: -1, limit: 4, minScore: 0.5 })).toEqual([]);
  });
});

describe('embedPrefix', () => {
  test('nomic モデルは search_document:/search_query: prefix を付ける', () => {
    expect(embedPrefix('nomic-embed-text', 'document')).toBe('search_document: ');
    expect(embedPrefix('nomic-embed-text:latest', 'query')).toBe('search_query: ');
  });

  test('非 nomic モデルは prefix なし', () => {
    expect(embedPrefix('mxbai-embed-large', 'document')).toBe('');
    expect(embedPrefix('bge-m3', 'query')).toBe('');
  });
});
