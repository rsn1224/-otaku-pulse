import type { DatabaseSync } from 'node:sqlite';
import { searchArticles } from '../db/fts.ts';
import { tryRouteFor } from '../llm/router.ts';
import type { Citation, LlmRequest } from '../llm/types.ts';
import type { ArticleDto } from '../types/dto.ts';

// discover_ai.rs の ai_search 移植 + ADR-2 ルーティング。
// web grounding 可能な provider（Perplexity）のときのみ AI 回答を付ける。

export interface AiSearchResult {
  localArticles: ArticleDto[];
  aiAnswer: string | null;
  citations: Citation[];
}

export async function aiSearch(db: DatabaseSync, query: string): Promise<AiSearchResult> {
  let local: ArticleDto[] = [];
  try {
    local = searchArticles(db, query, 20, 0);
  } catch {
    local = [];
  }

  const isQuestion = query.includes('？') || query.includes('?') || query.endsWith('とは');
  const needsAi = local.length < 3 || isQuestion;

  if (needsAi) {
    const client = tryRouteFor('search');
    if (client !== null && client.supportsWebSearch()) {
      try {
        const req: LlmRequest = {
          systemPrompt:
            'あなたはアニメ・ゲーム・漫画に詳しいアシスタントです。質問に対して日本語で簡潔に回答してください。',
          userPrompt: query,
          maxTokens: 400,
          webSearch: true,
          conversation: null,
          format: null,
        };
        const resp = await client.complete(req);
        return { localArticles: local, aiAnswer: resp.content, citations: resp.citations };
      } catch {
        // fall through to local-only
      }
    }
  }

  return { localArticles: local, aiAnswer: null, citations: [] };
}
