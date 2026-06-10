import type { DatabaseSync } from 'node:sqlite';
import { insertDigest, unsummarizedArticles } from '../db/digests.ts';
import { routeFor } from '../llm/router.ts';
import { type LlmClient, providerDebugName } from '../llm/types.ts';
import { digestPrompt } from './prompts/registry.ts';
import { buildRequest } from './prompts/types.ts';

// digest_generator.rs + scheduler::run_digest_now の移植。FE DigestResult は snake_case。

export interface DigestResult {
  category: string;
  summary: string;
  article_count: number;
  generated_at: string;
  is_ai_generated: boolean;
  provider: string | null;
  model: string | null;
  fallback_reason: string | null;
}

const STUBS: Record<string, string> = {
  anime:
    '・新作アニメ情報が更新されました\n・人気シリーズの最新話が配信開始\n・声優関連ニュースが話題に',
  manga: '・連載漫画の最新刊が発売\n・新人作家のデビュー作が注目\n・電子書籍限定コンテンツ追加',
  game: '・新作タイトルの発売情報\n・人気ゲームのアップデート実施\n・eスポーツ大会の開催決定',
  pc: '・最新PCパーツの価格動向\n・新グラフィックボード発表\n・ソフトウェアのセキュリティ更新',
};

function nowIso(): string {
  return new Date().toISOString();
}

function stubDigest(category: string, count: number, reason: string): DigestResult {
  return {
    category,
    summary: STUBS[category] ?? '関連ニュースが複数報道されています',
    article_count: count,
    generated_at: nowIso(),
    is_ai_generated: false,
    provider: null,
    model: null,
    fallback_reason: reason,
  };
}

export async function generateDigest(
  db: DatabaseSync,
  client: LlmClient,
  category: string,
): Promise<DigestResult> {
  const articles = unsummarizedArticles(db, category, 10);
  if (articles.length === 0) return stubDigest(category, 0, '記事がありません');

  try {
    const resp = await client.complete(buildRequest(digestPrompt, { category, articles }));
    return {
      category,
      summary: resp.content,
      article_count: articles.length,
      generated_at: nowIso(),
      is_ai_generated: true,
      provider: providerDebugName(resp.provider),
      model: resp.model,
      fallback_reason: null,
    };
  } catch (e) {
    return stubDigest(category, articles.length, `AI生成失敗: ${(e as Error).message}`);
  }
}

/** 全カテゴリの digest を生成し DB に保存する。 */
export async function runDigestNow(db: DatabaseSync): Promise<DigestResult[]> {
  const client = routeFor('digest');
  const categories = ['anime', 'manga', 'game', 'tech'];
  const out: DigestResult[] = [];

  for (const category of categories) {
    const digest = await generateDigest(db, client, category);
    insertDigest(db, {
      category,
      title: `${category} ダイジェスト`,
      contentMarkdown: digest.summary,
      contentHtml: null,
      articleIds: '',
      modelUsed: digest.model,
      tokenCount: null,
      generatedAt: digest.generated_at,
    });
    out.push(digest);
  }
  return out;
}
