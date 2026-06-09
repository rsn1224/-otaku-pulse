import type { DatabaseSync } from 'node:sqlite';
import { all, run } from '../db/query.ts';
import { type LlmClient, structuredRequest } from '../llm/types.ts';

// today_view_service.rs の移植。スコア上位記事を LLM で3点見出し化、3hキャッシュ。

export interface TodayViewItem {
  articleId: number;
  headline: string;
  rank: number;
  generatedAt: string;
}

const CACHE_TTL_HOURS = 3;
const TOP_ARTICLES_LIMIT = 10;

interface ScoredArticle {
  id: number;
  title: string;
}

function getCached(db: DatabaseSync): TodayViewItem[] {
  return all<{ article_id: number; headline: string; rank: number; generated_at: string }>(
    db,
    "SELECT article_id, headline, rank, generated_at FROM today_view WHERE generated_at >= datetime('now', ?) ORDER BY rank ASC",
    `-${CACHE_TTL_HOURS} hours`,
  ).map((r) => ({
    articleId: r.article_id,
    headline: r.headline,
    rank: r.rank,
    generatedAt: r.generated_at,
  }));
}

function fallbackItems(articles: ScoredArticle[]): TodayViewItem[] {
  return articles.slice(0, 3).map((a, i) => ({
    articleId: a.id,
    headline: Array.from(a.title).slice(0, 30).join(''),
    rank: i + 1,
    generatedAt: new Date().toISOString(),
  }));
}

async function generateWithLlm(
  llm: LlmClient,
  articles: ScoredArticle[],
): Promise<TodayViewItem[]> {
  const titlesList = articles.map((a, i) => `${i + 1}. ${a.title}`).join('\n');
  const schema = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            rank: { type: 'integer' },
            article_index: { type: 'integer' },
            headline: { type: 'string' },
          },
          required: ['rank', 'article_index', 'headline'],
        },
      },
    },
    required: ['items'],
  };
  const req = structuredRequest(
    'あなたはアニメ・マンガ・ゲームニュースのキュレーターです。',
    `以下の記事タイトルから、今日最も重要な3件を選び、それぞれ20文字以内の見出しを作ってください。次の JSON で重要度順に返してください: {"items": [{"rank": 1, "article_index": <元のリスト番号>, "headline": "見出し"}]}\n\n記事一覧:\n${titlesList}`,
    300,
    schema,
  );
  const resp = await llm.complete(req);

  let parsed: { items?: Array<{ rank?: number; article_index?: number; headline?: string }> };
  try {
    parsed = JSON.parse(resp.content.trim()) as typeof parsed;
  } catch {
    return fallbackItems(articles);
  }

  const items: TodayViewItem[] = [];
  for (const it of (parsed.items ?? []).slice(0, 3)) {
    const idx = Math.max(0, (it.article_index ?? 1) - 1);
    const a = articles[idx];
    if (a !== undefined && it.headline !== undefined) {
      items.push({
        articleId: a.id,
        headline: it.headline,
        rank: it.rank ?? items.length + 1,
        generatedAt: new Date().toISOString(),
      });
    }
  }
  return items.length === 0 ? fallbackItems(articles) : items;
}

export async function getTodayView(
  db: DatabaseSync,
  llm: LlmClient | null,
): Promise<TodayViewItem[]> {
  const cached = getCached(db);
  if (cached.length > 0) return cached;

  const articles = all<ScoredArticle>(
    db,
    `SELECT a.id, a.title FROM articles a
     LEFT JOIN article_scores s ON a.id = s.article_id
     WHERE a.is_duplicate = 0 AND a.published_at >= datetime('now', '-24 hours')
     ORDER BY COALESCE(s.total_score, a.importance_score) DESC LIMIT ?`,
    TOP_ARTICLES_LIMIT,
  );
  if (articles.length === 0) return [];

  let items: TodayViewItem[];
  if (llm !== null) {
    try {
      items = await generateWithLlm(llm, articles);
    } catch {
      items = fallbackItems(articles);
    }
  } else {
    items = fallbackItems(articles);
  }

  run(db, 'DELETE FROM today_view');
  for (const item of items) {
    run(
      db,
      "INSERT INTO today_view (article_id, headline, rank, generated_at) VALUES (?, ?, ?, datetime('now'))",
      item.articleId,
      item.headline,
      item.rank,
    );
  }
  return items;
}
