import type { CollectedArticle } from '../types/models.ts';

// scoring_service.rs + scoring_keywords.rs の移植。

const ANIME_KEYWORDS = [
  '新作',
  'アニメ化',
  '放送開始',
  '決定',
  'pv',
  'cm',
  '予告編',
  '第弾',
  'シリーズ',
  'キャスト',
  'スタッフ',
  '制作',
  '原作',
  '漫画',
  'ライトノベル',
  'ゲーム',
  '特報',
  '情報解禁',
];
const MANGA_KEYWORDS = [
  '連載開始',
  '新連載',
  '最終回',
  'アニメ化',
  'ドラマ化',
  '実写化',
  '単行本',
  'コミックス',
  '週刊',
  '月刊',
  'web漫画',
  '配信',
  'アプリ',
  '電子書籍',
  '巻',
  '話',
];
const GAME_KEYWORDS = [
  '発売',
  'dlc',
  'アップデート',
  'イベント',
  'キャンペーン',
  'セール',
  '限定',
  'コラボ',
  'シーズン',
  'パス',
  'beta',
  'alpha',
  'クローズド',
  'オープン',
  'プレ配信',
  'demo',
  '体験版',
];
const PC_KEYWORDS = [
  'gpu',
  'cpu',
  'ram',
  'ssd',
  'hdd',
  'windows',
  'linux',
  'mac',
  'driver',
  'bios',
  'uefi',
  'overclock',
  '水冷',
  '空冷',
  'ケース',
  '電源',
  'マザーボード',
  'メモリ',
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function calculateFreshness(publishedAt: string | null): number {
  if (publishedAt === null) return 0.5;
  const ms = Date.parse(publishedAt);
  if (Number.isNaN(ms)) return 0.5;
  const hoursAgo = Math.floor((Date.now() - ms) / 3_600_000); // num_hours 相当（切り捨て）
  if (hoursAgo <= 24) return 1.0;
  if (hoursAgo <= 48) return 0.5;
  return 0.0;
}

function keywordMatchScore(title: string, category: string): number {
  let keywords: string[];
  switch (category) {
    case 'anime':
      keywords = ANIME_KEYWORDS;
      break;
    case 'manga':
      keywords = MANGA_KEYWORDS;
      break;
    case 'game':
      keywords = GAME_KEYWORDS;
      break;
    case 'pc':
      keywords = PC_KEYWORDS;
      break;
    default:
      return 0.0;
  }
  const titleLower = title.toLowerCase();
  let matches = 0;
  for (const kw of keywords) {
    if (titleLower.includes(kw.toLowerCase())) matches++;
  }
  return Math.min(matches * 0.1, 0.3);
}

/** 重要度スコアを計算 (0.0-1.0)。 */
export function calculateImportance(article: CollectedArticle, category: string): number {
  const freshness = calculateFreshness(article.publishedAt);
  const keywordScore = keywordMatchScore(article.title, category);
  const contentScore = article.content !== null || article.summary !== null ? 0.2 : 0.0;
  const base = clamp(article.importanceScore, 0.0, 1.0);
  const total = base * 0.5 + freshness * 0.2 + keywordScore + contentScore;
  return clamp(total, 0.0, 1.0);
}
