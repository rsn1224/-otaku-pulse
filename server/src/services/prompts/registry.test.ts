import { describe, expect, test } from 'vitest';
import {
  ALL_PROMPTS,
  aiSearchPrompt,
  contextMemoPrompt,
  deepdiveAnswerPrompt,
  deepdiveQuestionsPrompt,
  digestPrompt,
  preferencesPrompt,
  summaryPrompt,
  todayViewPrompt,
  weeklyReportPrompt,
} from './registry.ts';
import {
  type AnyPromptSpec,
  buildRequest,
  isWellFormedSchema,
  type JsonSchema,
  type PromptSpec,
  promptRef,
  resolveSystem,
  validateAgainstSchema,
} from './types.ts';

// ADR-4 eval harness: prompt registry の契約・構造化出力スキーマ・builder を fixture に対し検証する。

function schemaOf(spec: AnyPromptSpec): JsonSchema {
  if (spec.schema === undefined) throw new Error(`${spec.id} に schema がありません`);
  return spec.schema;
}

function userOf<V>(spec: PromptSpec<V>): (vars: V) => string {
  if (spec.user === undefined) throw new Error(`${spec.id} に user builder がありません`);
  return spec.user;
}

describe('registry 契約', () => {
  test('id@version は一意', () => {
    const refs = ALL_PROMPTS.map(promptRef);
    expect(new Set(refs).size).toBe(refs.length);
  });

  test.each(
    ALL_PROMPTS.map((p) => [promptRef(p), p] as const),
  )('%s: id/version/maxTokens/system/schema 契約', (_ref, spec) => {
    expect(spec.id).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(spec.version).toBeGreaterThanOrEqual(1);
    expect(spec.maxTokens).toBeGreaterThan(0);
    expect(spec.maxTokens).toBeLessThanOrEqual(2000);
    if (typeof spec.system === 'string') {
      expect(spec.system.length).toBeGreaterThan(0);
    }
    if (spec.schema !== undefined) {
      expect(isWellFormedSchema(spec.schema)).toBe(true);
    }
  });
});

describe('構造化出力スキーマ（fixture 検証 = 回帰検出）', () => {
  test('today_view: 妥当な出力を受理し、欠落を拒否', () => {
    const s = schemaOf(todayViewPrompt);
    expect(
      validateAgainstSchema(s, { items: [{ rank: 1, article_index: 2, headline: 'x' }] }),
    ).toBe(true);
    expect(validateAgainstSchema(s, { items: [{ rank: 1, headline: 'x' }] })).toBe(false); // article_index 欠落
    expect(validateAgainstSchema(s, {})).toBe(false); // items 欠落
  });

  test('deepdive_questions: questions が string[] であること', () => {
    const s = schemaOf(deepdiveQuestionsPrompt);
    expect(validateAgainstSchema(s, { questions: ['a', 'b'] })).toBe(true);
    expect(validateAgainstSchema(s, { questions: [1, 2] })).toBe(false);
    expect(validateAgainstSchema(s, {})).toBe(false);
  });

  test('deepdive_answer: answer と followUps が必須', () => {
    const s = schemaOf(deepdiveAnswerPrompt);
    expect(validateAgainstSchema(s, { answer: 'a', followUps: ['x'] })).toBe(true);
    expect(validateAgainstSchema(s, { answer: 'a' })).toBe(false); // followUps 欠落
    expect(validateAgainstSchema(s, { answer: 1, followUps: [] })).toBe(false); // answer 型違い
  });
});

describe('system / user builder', () => {
  test('summary: title を含み本文を 1500 字で切る', () => {
    const out = userOf(summaryPrompt)({ title: 'タイトルX', sourceText: 'a'.repeat(2000) });
    expect(out).toContain('タイトルX');
    expect(out).toContain('a'.repeat(1500));
    expect(out).not.toContain('a'.repeat(1501));
  });

  test('digest: system にカテゴリ、user に記事行（summary 有無を分岐）', () => {
    expect(resolveSystem(digestPrompt, { category: 'anime', articles: [] })).toContain('anime');
    const usr = userOf(digestPrompt)({
      category: 'anime',
      articles: [
        { title: 'A作品', summary: '概要' },
        { title: 'B作品', summary: null },
      ],
    });
    expect(usr).toContain('・A作品: 概要');
    expect(usr).toContain('・B作品');
    expect(usr).not.toContain('・B作品:');
  });

  test('today_view: 1始まりの番号付きタイトル', () => {
    const usr = userOf(todayViewPrompt)({ articles: [{ title: 'T1' }, { title: 'T2' }] });
    expect(usr).toContain('1. T1');
    expect(usr).toContain('2. T2');
  });

  test('preferences / context_memo / weekly_report: vars が注入される', () => {
    expect(userOf(preferencesPrompt)({ statsText: 'anime: 5件', topTitles: ['作品A'] })).toContain(
      '作品A',
    );
    expect(userOf(contextMemoPrompt)({ title: '記事Z', historyText: '・閲覧: X' })).toContain(
      '記事Z',
    );
    expect(userOf(weeklyReportPrompt)({ titles: ['週次A', '週次B'] })).toContain('週次A');
  });
});

describe('buildRequest', () => {
  test('webSearch フラグが反映される', () => {
    expect(buildRequest(summaryPrompt, { title: 't', sourceText: 's' }).webSearch).toBe(false);
    expect(buildRequest(aiSearchPrompt, { query: 'q' }).webSearch).toBe(true);
  });

  test('schema 付きは format に schema が入る', () => {
    const req = buildRequest(todayViewPrompt, { articles: [{ title: 'x' }] });
    expect(req.format).toBe(todayViewPrompt.schema);
  });

  test('user builder の無い spec は例外', () => {
    expect(() => buildRequest(deepdiveAnswerPrompt, undefined)).toThrow();
  });
});

describe('schema validator', () => {
  test('isWellFormedSchema: required が properties に無いと false', () => {
    expect(
      isWellFormedSchema({
        type: 'object',
        properties: { a: { type: 'string' } },
        required: ['b'],
      }),
    ).toBe(false);
    expect(
      isWellFormedSchema({
        type: 'object',
        properties: { a: { type: 'string' } },
        required: ['a'],
      }),
    ).toBe(true);
  });
});
