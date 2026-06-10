import type { DatabaseSync } from 'node:sqlite';
import { all, get, run } from '../db/query.ts';
import { AppError } from '../error.ts';
import type { LlmClient } from '../llm/types.ts';
import { batchSummaryPrompt, summaryPrompt } from './prompts/registry.ts';
import { buildRequest } from './prompts/types.ts';

// summary_service.rs + highlights_service::batch_generate_summaries の移植。

export async function getOrGenerateSummary(
  db: DatabaseSync,
  articleId: number,
  llm: LlmClient,
): Promise<string> {
  const cached = get<{ ai_summary: string | null }>(
    db,
    'SELECT ai_summary FROM articles WHERE id = ?',
    articleId,
  );
  if (cached?.ai_summary != null && cached.ai_summary !== '') return cached.ai_summary;

  const row = get<{ title: string; summary: string | null; content: string | null }>(
    db,
    'SELECT title, summary, content FROM articles WHERE id = ?',
    articleId,
  );
  if (row === undefined) throw new AppError('database', '記事が見つかりません');

  const sourceText = row.content ?? row.summary ?? '';
  if (sourceText === '') {
    const fallback = `「${row.title}」に関するニュース記事。`;
    run(
      db,
      "UPDATE articles SET ai_summary = ?, ai_summary_generated_at = datetime('now') WHERE id = ?",
      fallback,
      articleId,
    );
    return fallback;
  }

  const req = buildRequest(summaryPrompt, { title: row.title, sourceText });
  const response = await llm.complete(req);
  const aiSummary = response.content.trim();

  run(
    db,
    "UPDATE articles SET ai_summary = ?, ai_summary_generated_at = datetime('now') WHERE id = ?",
    aiSummary,
    articleId,
  );
  return aiSummary;
}

export async function batchGenerateSummaries(
  db: DatabaseSync,
  llm: LlmClient,
  limit: number,
): Promise<number> {
  const rows = all<{ id: number; title: string; summary: string | null; content: string | null }>(
    db,
    `SELECT a.id, a.title, a.summary, a.content
     FROM articles a LEFT JOIN article_scores s ON a.id = s.article_id
     WHERE a.is_duplicate = 0 AND a.ai_summary IS NULL
       AND a.published_at >= datetime('now', '-48 hours')
     ORDER BY COALESCE(s.total_score, a.importance_score) DESC LIMIT ?`,
    limit,
  );

  let generated = 0;
  for (const r of rows) {
    const sourceText = r.content ?? r.summary ?? '';
    if (sourceText === '') continue;
    const req = buildRequest(batchSummaryPrompt, { title: r.title, sourceText });
    try {
      const response = await llm.complete(req);
      run(
        db,
        "UPDATE articles SET ai_summary = ?, ai_summary_generated_at = datetime('now') WHERE id = ?",
        response.content.trim(),
        r.id,
      );
      generated += 1;
    } catch {
      break; // LLM エラーなら残りもスキップ
    }
  }
  return generated;
}
