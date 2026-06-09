import type { DatabaseSync } from 'node:sqlite';
import { all, get, run } from '../db/query.ts';
import { AppError } from '../error.ts';
import { type LlmClient, simpleRequest } from '../llm/types.ts';

// context_memo_service.rs の移植。記事ごとの文脈メモを LLM 生成 + キャッシュ。

interface HistoryRow {
  title: string;
  action: string;
}

async function generateMemo(llm: LlmClient, title: string, history: HistoryRow[]): Promise<string> {
  const historyText =
    history.length === 0
      ? '（閲覧履歴なし）'
      : history
          .map((h) => {
            const label =
              h.action === 'bookmark'
                ? 'ブックマーク'
                : h.action === 'deepdive'
                  ? 'Deep Dive'
                  : '閲覧';
            return `・${label}: ${h.title}`;
          })
          .join('\n');

  const req = simpleRequest(
    'あなたはアニメ・マンガ・ゲームニュースのアシスタントです。ユーザーの閲覧履歴を踏まえ、対象記事の文脈を1〜2文で簡潔に説明してください。「前回は〜を確認済み」「継続して〜に関心を持っている」などの形式が適しています。',
    `対象記事: ${title}\n\n最近の閲覧履歴:\n${historyText}\n\nこの記事の文脈メモを1〜2文で生成してください。`,
    150,
  );
  const response = await llm.complete(req);
  return response.content.trim().replace(/^"+|"+$/g, '');
}

export async function getOrGenerateContextMemo(
  db: DatabaseSync,
  llm: LlmClient,
  articleId: number,
): Promise<string> {
  const cached = get<{ memo: string }>(
    db,
    'SELECT memo FROM article_context_memos WHERE article_id = ?',
    articleId,
  );
  if (cached !== undefined) return cached.memo;

  const titleRow = get<{ title: string }>(db, 'SELECT title FROM articles WHERE id = ?', articleId);
  if (titleRow === undefined) throw new AppError('invalid_input', `article ${articleId} not found`);
  const title = titleRow.title;

  const history = all<HistoryRow>(
    db,
    `SELECT a.title, ai.action
     FROM article_interactions ai
     JOIN articles a ON a.id = ai.article_id
     WHERE ai.article_id != ? AND ai.action IN ('open', 'bookmark', 'deepdive')
     ORDER BY ai.created_at DESC LIMIT 5`,
    articleId,
  );

  let memo: string;
  try {
    memo = await generateMemo(llm, title, history);
  } catch {
    memo = `「${title}」に関する記事です。`;
  }

  run(
    db,
    "INSERT OR REPLACE INTO article_context_memos (article_id, memo, generated_at) VALUES (?, ?, datetime('now'))",
    articleId,
    memo,
  );
  return memo;
}
