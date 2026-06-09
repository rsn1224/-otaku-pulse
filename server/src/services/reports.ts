import type { DatabaseSync } from 'node:sqlite';
import { insertDigest } from '../db/digests.ts';
import { all } from '../db/query.ts';
import { tryRouteFor } from '../llm/router.ts';
import type { LlmRequest } from '../llm/types.ts';

// commands/digest.rs の run_weekly_report_now / run_research_report 移植 + ADR-2 ルーティング。
// Deep research は web 検索が要るため web grounding 可能な provider（Perplexity）必須。

const WEB_REQUIRED =
  'スキップ: web 検索可能な provider（Perplexity API キー）が必要です（deep research）';

export async function runResearchReport(db: DatabaseSync, query: string): Promise<string> {
  const client = tryRouteFor('research');
  if (client === null || !client.supportsWebSearch()) return WEB_REQUIRED;

  const req: LlmRequest = {
    systemPrompt:
      'あなたは調査アシスタントです。与えられたトピックについて web を調査し、日本語で構造化された調査レポート（Markdown）を作成してください。',
    userPrompt: query,
    maxTokens: 1500,
    webSearch: true,
    conversation: null,
    format: null,
  };
  const resp = await client.complete(req);
  const title = `調査: ${query}`;
  insertDigest(db, {
    category: 'weekly_report',
    title,
    contentMarkdown: resp.content,
    contentHtml: null,
    articleIds: '',
    modelUsed: resp.model,
    tokenCount: null,
    generatedAt: new Date().toISOString(),
  });
  return `調査レポートを生成しました: ${title}`;
}

export async function runWeeklyReportNow(db: DatabaseSync): Promise<string> {
  const client = tryRouteFor('research');
  if (client === null || !client.supportsWebSearch()) return WEB_REQUIRED;

  const titles = all<{ title: string }>(
    db,
    `SELECT title FROM articles WHERE is_duplicate = 0 AND published_at >= datetime('now', '-7 days')
     ORDER BY importance_score DESC LIMIT 30`,
  ).map((r) => r.title);
  if (titles.length === 0) return 'スキップ: 対象記事がありません';

  const req: LlmRequest = {
    systemPrompt:
      '過去1週間のオタクニュースを俯瞰し、重要トピックを web 調査で補強した週次レポート（Markdown）を日本語で作成してください。',
    userPrompt: `今週の主な記事:\n${titles.join('\n')}`,
    maxTokens: 1500,
    webSearch: true,
    conversation: null,
    format: null,
  };
  const resp = await client.complete(req);
  insertDigest(db, {
    category: 'weekly_report',
    title: '週次レポート',
    contentMarkdown: resp.content,
    contentHtml: null,
    articleIds: '',
    modelUsed: resp.model,
    tokenCount: null,
    generatedAt: new Date().toISOString(),
  });
  return '1件のレポートを生成しました';
}
