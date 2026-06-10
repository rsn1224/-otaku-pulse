import type { AnyPromptSpec, JsonSchema, PromptSpec } from './types.ts';

// ADR-4: versioned prompt registry（SSOT）。各サービスはここを参照し inline プロンプトを持たない。
// version はプロンプト本文を変更したら上げる。eval（registry.test.ts）が契約を検査する。

// ── summary ──────────────────────────────────────────────────────────
export const summaryPrompt: PromptSpec<{ title: string; sourceText: string }> = {
  id: 'summary',
  version: 1,
  system:
    'あなたはニュース記事の要約者です。与えられたテキストの内容だけを要約すること。外部検索は使わないこと。日本語で2〜3文の簡潔な要約を生成すること。謝罪や注釈は絶対に書かないこと。',
  maxTokens: 200,
  user: (v) =>
    `以下の記事を要約してください。\n\nタイトル: ${v.title}\n\n本文: ${v.sourceText.slice(0, 1500)}`,
};

export const batchSummaryPrompt: PromptSpec<{ title: string; sourceText: string }> = {
  id: 'batch_summary',
  version: 1,
  system:
    '与えられたテキストだけを使って日本語で2文の要約を書いてください。外部検索は使わないこと。謝罪や注釈は書かないこと。',
  maxTokens: 150,
  user: (v) => `タイトル: ${v.title}\n\n本文: ${v.sourceText.slice(0, 1200)}`,
};

// ── digest ───────────────────────────────────────────────────────────
export const digestPrompt: PromptSpec<{
  category: string;
  articles: Array<{ title: string; summary: string | null }>;
}> = {
  id: 'digest',
  version: 1,
  system: (v) =>
    `あなたはアニメ・ゲーム情報のキュレーターです。提供されたニュース記事のタイトルとサマリーを読み、日本語で簡潔なダイジェストを生成してください。カテゴリ: ${v.category}。箇条書きで上位3〜5件の重要ニュースをまとめてください。各項目は「・タイトル: 内容の要点」の形式で記述してください。`,
  maxTokens: 1000,
  user: (v) =>
    v.articles
      .map((a) => (a.summary !== null ? `・${a.title}: ${a.summary}` : `・${a.title}`))
      .join('\n'),
};

// ── today view ───────────────────────────────────────────────────────
const TODAY_VIEW_SCHEMA: JsonSchema = {
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

export const todayViewPrompt: PromptSpec<{ articles: Array<{ title: string }> }> = {
  id: 'today_view',
  version: 1,
  system: 'あなたはアニメ・マンガ・ゲームニュースのキュレーターです。',
  maxTokens: 300,
  schema: TODAY_VIEW_SCHEMA,
  user: (v) =>
    `以下の記事タイトルから、今日最も重要な3件を選び、それぞれ20文字以内の見出しを作ってください。次の JSON で重要度順に返してください: {"items": [{"rank": 1, "article_index": <元のリスト番号>, "headline": "見出し"}]}\n\n記事一覧:\n${v.articles.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}`,
};

// ── context memo ─────────────────────────────────────────────────────
export const contextMemoPrompt: PromptSpec<{ title: string; historyText: string }> = {
  id: 'context_memo',
  version: 1,
  system:
    'あなたはアニメ・マンガ・ゲームニュースのアシスタントです。ユーザーの閲覧履歴を踏まえ、対象記事の文脈を1〜2文で簡潔に説明してください。「前回は〜を確認済み」「継続して〜に関心を持っている」などの形式が適しています。',
  maxTokens: 150,
  user: (v) =>
    `対象記事: ${v.title}\n\n最近の閲覧履歴:\n${v.historyText}\n\nこの記事の文脈メモを1〜2文で生成してください。`,
};

// ── preferences ──────────────────────────────────────────────────────
export const preferencesPrompt: PromptSpec<{ statsText: string; topTitles: string[] }> = {
  id: 'preferences',
  version: 1,
  system:
    'ユーザーの閲覧行動データから趣味嗜好を推定してください。JSON形式で返してください:\n{"titles": ["作品名1"], "genres": ["ジャンル1"], "creators": ["クリエイター名1"], "reason": "推定理由"}\n各配列は3件以内。reason は20文字以内。',
  maxTokens: 300,
  user: (v) =>
    `カテゴリ別閲覧数: ${v.statsText}\n\nブックマーク/深堀りした記事:\n${v.topTitles.join('\n')}`,
};

// ── AI search（web grounding）────────────────────────────────────────
export const aiSearchPrompt: PromptSpec<{ query: string }> = {
  id: 'ai_search',
  version: 1,
  system:
    'あなたはアニメ・ゲーム・漫画に詳しいアシスタントです。質問に対して日本語で簡潔に回答してください。',
  maxTokens: 400,
  webSearch: true,
  user: (v) => v.query,
};

// ── research / weekly report（web grounding）─────────────────────────
export const researchReportPrompt: PromptSpec<{ query: string }> = {
  id: 'research_report',
  version: 1,
  system:
    'あなたは調査アシスタントです。与えられたトピックについて web を調査し、日本語で構造化された調査レポート（Markdown）を作成してください。',
  maxTokens: 1500,
  webSearch: true,
  user: (v) => v.query,
};

export const weeklyReportPrompt: PromptSpec<{ titles: string[] }> = {
  id: 'weekly_report',
  version: 1,
  system:
    '過去1週間のオタクニュースを俯瞰し、重要トピックを web 調査で補強した週次レポート（Markdown）を日本語で作成してください。',
  maxTokens: 1500,
  webSearch: true,
  user: (v) => `今週の主な記事:\n${v.titles.join('\n')}`,
};

// ── deepdive: questions（完全移行） ──────────────────────────────────
const DEEPDIVE_QUESTIONS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions'],
};

export const deepdiveQuestionsPrompt: PromptSpec<{ title: string; context: string }> = {
  id: 'deepdive_questions',
  version: 1,
  system:
    'あなたはオタク向けニュースの質問生成AIです。記事について、ユーザーが気になりそうな具体的な質問を3つ (各25文字以内) 生成し、JSON {"questions": ["質問1", "質問2", "質問3"]} で返してください。',
  maxTokens: 200,
  schema: DEEPDIVE_QUESTIONS_SCHEMA,
  user: (v) => `タイトル: ${v.title}\nサマリー: ${v.context}`,
};

// ── deepdive: answer / stream（user prompt は grounding ロジックで構築のため user 省略） ──
export const DEEPDIVE_ANSWER_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    followUps: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'followUps'],
};

// ADR-3: 構造化出力。脆い ---FOLLOWUP--- delimiter を撤廃し JSON schema で拘束する。
export const deepdiveAnswerPrompt: PromptSpec = {
  id: 'deepdive_answer',
  version: 1,
  system:
    'あなたはアニメ・ゲーム・漫画に詳しい情報アシスタントです。質問に対して、正確で簡潔な回答を日本語（Markdown、200文字以内）で作成し、関連する追加質問を2つ提案してください。回答は必ず「元の記事」を主題とすること。「関連する収集済み記事」は背景知識・補足としてのみ参考にし、元の記事と無関係なものは無視すること。JSON {"answer": "回答本文", "followUps": ["追加質問1", "追加質問2"]} で返してください。',
  maxTokens: 400,
  webSearch: true,
  schema: DEEPDIVE_ANSWER_SCHEMA,
};

// ADR-5: ストリーミング用 delimiter prompt（free-text。逐次配信向け。followUps は末尾 ---FOLLOWUP---）。
export const deepdiveStreamPrompt: PromptSpec = {
  id: 'deepdive_stream',
  version: 1,
  system:
    'あなたはアニメ・ゲーム・漫画に詳しい情報アシスタントです。質問に対して、正確で簡潔な回答を日本語（Markdown、200文字以内）で提供してください。回答は必ず「元の記事」を主題とすること。「関連する収集済み記事」は背景知識・補足としてのみ参考にし、元の記事と無関係なものは無視すること。回答の最後に、関連する追加質問を2つ提案してください。形式:\n回答本文\n\n---FOLLOWUP---\n["追加質問1", "追加質問2"]',
  maxTokens: 400,
  webSearch: true,
};

/** eval harness が走査する全 prompt。新規 prompt はここに追加する。 */
export const ALL_PROMPTS: readonly AnyPromptSpec[] = [
  summaryPrompt,
  batchSummaryPrompt,
  digestPrompt,
  todayViewPrompt,
  contextMemoPrompt,
  preferencesPrompt,
  aiSearchPrompt,
  researchReportPrompt,
  weeklyReportPrompt,
  deepdiveQuestionsPrompt,
  deepdiveAnswerPrompt,
  deepdiveStreamPrompt,
];
