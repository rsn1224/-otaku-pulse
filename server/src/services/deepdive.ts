import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { get, run } from '../db/query.ts';
import { AppError } from '../error.ts';
import {
  parseAnswerWithFollowups,
  parseQuestionArray,
  parseStringArrayField,
} from '../llm/helpers.ts';
import {
  type ChatMessage,
  type LlmClient,
  type LlmRequest,
  type LlmResponse,
  providerDebugName,
  structuredRequest,
} from '../llm/types.ts';
import { type RetrievedContext, retrieveRelated } from './embeddings.ts';

type Citation = { url: string; title: string | null };

// ADR-5: ストリーミング用 delimiter prompt（free-text。逐次配信向け。followUps は末尾 ---FOLLOWUP---）。
const STREAM_SYSTEM_PROMPT =
  'あなたはアニメ・ゲーム・漫画に詳しい情報アシスタントです。質問に対して、正確で簡潔な回答を日本語（Markdown、200文字以内）で提供してください。回答は必ず「元の記事」を主題とすること。「関連する収集済み記事」は背景知識・補足としてのみ参考にし、元の記事と無関係なものは無視すること。回答の最後に、関連する追加質問を2つ提案してください。形式:\n回答本文\n\n---FOLLOWUP---\n["追加質問1", "追加質問2"]';

// deepdive_service.rs の移植。

export interface DeepDiveResult {
  question: string;
  answer: string;
  followUpQuestions: string[];
  provider: string;
  citations: Array<{ url: string; title: string | null }>;
}

// ADR-3: 構造化出力。脆い ---FOLLOWUP--- delimiter を撤廃し JSON schema で拘束する。
const SYSTEM_PROMPT =
  'あなたはアニメ・ゲーム・漫画に詳しい情報アシスタントです。質問に対して、正確で簡潔な回答を日本語（Markdown、200文字以内）で作成し、関連する追加質問を2つ提案してください。回答は必ず「元の記事」を主題とすること。「関連する収集済み記事」は背景知識・補足としてのみ参考にし、元の記事と無関係なものは無視すること。JSON {"answer": "回答本文", "followUps": ["追加質問1", "追加質問2"]} で返してください。';

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    followUps: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'followUps'],
};

/** 構造化出力 {answer, followUps} をパース。非対応 provider 向けに ---FOLLOWUP--- フォールバック。 */
function parseStructuredAnswer(content: string): [string, string[]] {
  try {
    const obj = JSON.parse(content.trim()) as { answer?: unknown; followUps?: unknown };
    if (typeof obj.answer === 'string') {
      const followUps = Array.isArray(obj.followUps)
        ? obj.followUps.filter((x): x is string => typeof x === 'string')
        : [];
      return [obj.answer, followUps];
    }
  } catch {
    // fall through to delimiter fallback
  }
  return parseAnswerWithFollowups(content);
}

function hashSummary(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/** grounding 取得。embeddings 停止/未生成時は [] にフォールバックし web のみの挙動へ degrade する。 */
async function groundingFor(
  db: DatabaseSync,
  articleId: number,
  title: string,
  question: string,
): Promise<RetrievedContext[]> {
  try {
    return await retrieveRelated(db, `${title}\n${question}`, { excludeId: articleId });
  } catch {
    return [];
  }
}

/** 元記事 + RAG で取得した関連収集記事を含む user prompt を組み立てる。 */
export function buildGroundedUserPrompt(
  title: string,
  context: string,
  question: string,
  contexts: RetrievedContext[],
): string {
  const base = `元の記事:\nタイトル: ${title}\nサマリー: ${context}`;
  if (contexts.length === 0) return `${base}\n\n質問: ${question}`;
  const related = contexts.map((c, i) => `[${i + 1}] ${c.title} — ${c.summary ?? ''}`).join('\n');
  return `${base}\n\n関連する収集済み記事:\n${related}\n\n質問: ${question}`;
}

/** url を持つ関連記事のみ citation 化する。 */
export function contextsToCitations(contexts: RetrievedContext[]): Citation[] {
  const out: Citation[] = [];
  for (const c of contexts) {
    if (c.url !== null) out.push({ url: c.url, title: c.title });
  }
  return out;
}

/** local（収集記事）を先頭に web citation をマージし、url で重複排除する。 */
export function mergeCitations(web: Citation[], local: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of [...local, ...web]) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    out.push(c);
  }
  return out;
}

/** キャッシュの JSON 配列カラムを安全にパースする。 */
function parseJsonArray<T>(s: string | null): T[] {
  if (s === null) return [];
  try {
    const v = JSON.parse(s) as unknown;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

interface ArticleRow {
  title: string;
  summary: string | null;
  content: string | null;
}

function articleOrThrow(db: DatabaseSync, articleId: number): ArticleRow {
  const row = get<ArticleRow>(
    db,
    'SELECT title, summary, content FROM articles WHERE id = ?',
    articleId,
  );
  if (row === undefined) throw new AppError('database', '記事が見つかりません');
  return row;
}

/**
 * deepdive の文脈テキスト。AniList 由来エントリ等は summary が空で content にあらすじが入るため、
 * summary を優先しつつ content にフォールバックする（空のまま prompt に渡すと関連記事に乗っ取られる）。
 */
function articleContext(row: { summary: string | null; content: string | null }): string {
  return (row.summary ?? row.content ?? '').slice(0, 1500);
}

/** 会話途中で provider が変わっていたら拒否する。 */
export function checkProviderConsistency(
  db: DatabaseSync,
  articleId: number,
  currentProvider: string,
): void {
  const row = get<{ provider: string | null }>(
    db,
    'SELECT provider FROM deepdive_cache WHERE article_id = ? AND provider IS NOT NULL LIMIT 1',
    articleId,
  );
  if (row?.provider != null && row.provider !== currentProvider) {
    throw new AppError(
      'invalid_input',
      'LLM provider changed since conversation started. Please start a new conversation.',
    );
  }
}

export async function generateQuestions(
  db: DatabaseSync,
  articleId: number,
  llm: LlmClient,
): Promise<string[]> {
  const row = articleOrThrow(db, articleId);
  const schema = {
    type: 'object',
    properties: { questions: { type: 'array', items: { type: 'string' } } },
    required: ['questions'],
  };
  const req = structuredRequest(
    'あなたはオタク向けニュースの質問生成AIです。記事について、ユーザーが気になりそうな具体的な質問を3つ (各25文字以内) 生成し、JSON {"questions": ["質問1", "質問2", "質問3"]} で返してください。',
    `タイトル: ${row.title}\nサマリー: ${articleContext(row)}`,
    200,
    schema,
  );
  const response = await llm.complete(req);
  return (
    parseStringArrayField(response.content, 'questions') ?? parseQuestionArray(response.content)
  );
}

export async function answerQuestion(
  db: DatabaseSync,
  articleId: number,
  question: string,
  llm: LlmClient,
): Promise<DeepDiveResult> {
  const cached = get<{
    answer: string;
    follow_ups: string | null;
    provider: string | null;
    summary_hash: string | null;
    citations: string | null;
  }>(
    db,
    'SELECT answer, follow_ups, provider, summary_hash, citations FROM deepdive_cache WHERE article_id = ? AND question = ?',
    articleId,
    question,
  );

  if (cached !== undefined) {
    const cur = get<{ summary: string | null; content: string | null }>(
      db,
      'SELECT summary, content FROM articles WHERE id = ?',
      articleId,
    );
    const currentHash = cur !== undefined ? hashSummary(articleContext(cur)) : null;
    if ((cached.summary_hash ?? null) === currentHash) {
      return {
        question,
        answer: cached.answer,
        followUpQuestions: parseJsonArray<string>(cached.follow_ups),
        provider: cached.provider ?? '',
        citations: parseJsonArray<Citation>(cached.citations),
      };
    }
    run(
      db,
      'DELETE FROM deepdive_cache WHERE article_id = ? AND question = ?',
      articleId,
      question,
    );
  }

  const row = articleOrThrow(db, articleId);
  const context = articleContext(row);
  const summaryHash = hashSummary(context);
  const contexts = await groundingFor(db, articleId, row.title, question);
  const req: LlmRequest = {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildGroundedUserPrompt(row.title, context, question, contexts),
    maxTokens: 400,
    webSearch: true,
    conversation: null,
    format: ANSWER_SCHEMA,
  };
  const response = await llm.complete(req);
  const [answer, followUps] = parseStructuredAnswer(response.content);
  const providerStr = providerDebugName(llm.provider());
  const citations = mergeCitations(response.citations, contextsToCitations(contexts));

  run(
    db,
    'INSERT OR REPLACE INTO deepdive_cache (article_id, question, answer, follow_ups, provider, summary_hash, citations) VALUES (?, ?, ?, ?, ?, ?, ?)',
    articleId,
    question,
    answer,
    JSON.stringify(followUps),
    providerStr,
    summaryHash,
    JSON.stringify(citations),
  );

  return {
    question,
    answer,
    followUpQuestions: followUps,
    provider: providerStr,
    citations,
  };
}

export async function answerFollowup(
  db: DatabaseSync,
  articleId: number,
  question: string,
  history: ChatMessage[],
  llm: LlmClient,
): Promise<DeepDiveResult> {
  const row = articleOrThrow(db, articleId);
  const contexts = await groundingFor(db, articleId, row.title, question);
  const req: LlmRequest = {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildGroundedUserPrompt(row.title, articleContext(row), question, contexts),
    maxTokens: 400,
    webSearch: true,
    conversation: history,
    format: ANSWER_SCHEMA,
  };
  const response = await llm.complete(req);
  const [answer, followUps] = parseStructuredAnswer(response.content);
  return {
    question,
    answer,
    followUpQuestions: followUps,
    provider: providerDebugName(llm.provider()),
    citations: mergeCitations(response.citations, contextsToCitations(contexts)),
  };
}

/**
 * ADR-5: ストリーミング deepdive。answer トークンを onToken に逐次流す。
 * free-text + delimiter（followUps は末尾）。生トークンを流すため FE 側で ---FOLLOWUP--- を除去する。
 * single-turn のみキャッシュ（followup は会話依存で非キャッシュ）。
 */
export async function streamAnswer(
  db: DatabaseSync,
  articleId: number,
  question: string,
  history: ChatMessage[] | null,
  llm: LlmClient,
  onToken: (chunk: string) => void,
): Promise<DeepDiveResult> {
  const row = articleOrThrow(db, articleId);
  const isSingle = history === null || history.length === 0;

  // single-turn はキャッシュ有効なら即時配信（非ストリーミング経路と整合）。
  if (isSingle) {
    const cached = get<{
      answer: string;
      follow_ups: string | null;
      provider: string | null;
      summary_hash: string | null;
      citations: string | null;
    }>(
      db,
      'SELECT answer, follow_ups, provider, summary_hash, citations FROM deepdive_cache WHERE article_id = ? AND question = ?',
      articleId,
      question,
    );
    if (cached !== undefined) {
      const currentHash = hashSummary(articleContext(row));
      if ((cached.summary_hash ?? null) === currentHash) {
        onToken(cached.answer);
        return {
          question,
          answer: cached.answer,
          followUpQuestions: parseJsonArray<string>(cached.follow_ups),
          provider: cached.provider ?? '',
          citations: parseJsonArray<Citation>(cached.citations),
        };
      }
      run(
        db,
        'DELETE FROM deepdive_cache WHERE article_id = ? AND question = ?',
        articleId,
        question,
      );
    }
  }

  const context = articleContext(row);
  const contexts = await groundingFor(db, articleId, row.title, question);
  const req: LlmRequest = {
    systemPrompt: STREAM_SYSTEM_PROMPT,
    userPrompt: buildGroundedUserPrompt(row.title, context, question, contexts),
    maxTokens: 400,
    webSearch: true,
    conversation: history,
    format: null,
  };

  let response: LlmResponse;
  if (llm.supportsStreaming() && llm.streamComplete !== undefined) {
    response = await llm.streamComplete(req, onToken);
  } else {
    response = await llm.complete(req);
    onToken(response.content); // 非対応 provider は一括送出
  }

  const [answer, followUps] = parseAnswerWithFollowups(response.content);
  const providerStr = providerDebugName(llm.provider());
  const citations = mergeCitations(response.citations, contextsToCitations(contexts));

  if (isSingle) {
    const summaryHash = hashSummary(context);
    run(
      db,
      'INSERT OR REPLACE INTO deepdive_cache (article_id, question, answer, follow_ups, provider, summary_hash, citations) VALUES (?, ?, ?, ?, ?, ?, ?)',
      articleId,
      question,
      answer,
      JSON.stringify(followUps),
      providerStr,
      summaryHash,
      JSON.stringify(citations),
    );
  }

  return {
    question,
    answer,
    followUpQuestions: followUps,
    provider: providerStr,
    citations,
  };
}
