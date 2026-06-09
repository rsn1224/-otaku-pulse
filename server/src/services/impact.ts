// impact_classifier.rs の移植。LLM なしのキーワード分類。

export type ImpactLevel = 'confirmed' | 'rumor' | 'general';

const CONFIRMED_KEYWORDS = [
  '発売決定',
  '発売日',
  '発売確定',
  '正式発表',
  '公式発表',
  '情報解禁',
  'アニメ化決定',
  '映画化決定',
  'ドラマ化決定',
  '実写化決定',
  '連載開始',
  '新作発表',
  '最終回',
  '完結',
  'PV公開',
  'MV公開',
  'トレーラー公開',
  'キャスト発表',
  '主題歌発表',
  '放送開始',
  '配信開始',
  '発売',
  'release date',
  'officially announced',
  'confirmed',
  'launches',
  'now available',
  'officially revealed',
  'trailer released',
  'final episode',
  'season confirmed',
  'greenlit',
];

const RUMOR_KEYWORDS = [
  'リーク',
  '噂',
  'らしい',
  '予定か',
  '検討中',
  '未発表',
  'フライング',
  '流出',
  '内部情報',
  '匿名情報',
  '関係者によると',
  'とのこと',
  'とされる',
  'との報道',
  '未確認',
  'leak',
  'leaked',
  'rumor',
  'rumour',
  'reportedly',
  'reportedly confirmed',
  'might',
  'could be',
  'unconfirmed',
  'sources say',
  'according to sources',
  'insider',
];

/** タイトル + 任意 content から impact を分類。優先度: Confirmed > Rumor > General。 */
export function classifyImpact(title: string, content: string | null): ImpactLevel {
  const titleLower = title.toLowerCase();
  const contentLower = (content ?? '').toLowerCase();

  for (const kw of CONFIRMED_KEYWORDS) {
    const k = kw.toLowerCase();
    if (titleLower.includes(k) || contentLower.includes(k)) return 'confirmed';
  }
  for (const kw of RUMOR_KEYWORDS) {
    const k = kw.toLowerCase();
    if (titleLower.includes(k) || contentLower.includes(k)) return 'rumor';
  }
  return 'general';
}
