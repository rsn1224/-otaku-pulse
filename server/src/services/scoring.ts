import type { CollectedArticle } from '../types/models.ts';
import type { ImpactLevel } from './impact.ts';

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

// ── 統一スコアリングパイプライン (ADR-6) ──────────────────────────────
// base(freshness/keyword/content) + impact + 暗黙FB を pluggable factor で合成し
// article_scores.total_score に永続化する。collection 時の calculateImportance は
// base シグナル(=importance_score)を担当し、ここでは rescore 時に impact / 暗黙FB を重ねる。

/** 暗黙FB の action 別重み (engagement raw 値の算出に使う。discover の live クエリと一致)。 */
export const ENGAGEMENT_WEIGHTS = { open: 1.0, bookmark: 3.0, deepdive: 2.5 } as const;

/** engagement raw 値の飽和点。raw = SATURATION で personal=0.5。 */
const ENGAGEMENT_SATURATION = 5.0;

function impactScore(level: ImpactLevel): number {
  switch (level) {
    case 'confirmed':
      return 1.0;
    case 'rumor':
      return 0.2;
    default:
      return 0.5;
  }
}

/** engagement raw 値 (>=0) を 0..1 に飽和写像する。1〜2件の interaction が支配しないように。 */
function saturateEngagement(raw: number): number {
  if (raw <= 0) return 0;
  return raw / (raw + ENGAGEMENT_SATURATION);
}

/** 統一スコアの入力シグナル。 */
export interface ScoringSignals {
  /** base(freshness/keyword/content) = articles.importance_score (0..1)。 */
  base: number;
  impact: ImpactLevel;
  /** 暗黙FB の重み付き raw 合計 (>=0)。 */
  engagement: number;
}

/** 合成因子。weight × value(signals) を総和して total を得る。pluggable。 */
export interface ScoringFactor {
  readonly name: string;
  readonly weight: number;
  readonly value: (s: ScoringSignals) => number;
}

/** 既定の因子セット。weight 調整で挙動を変えられる (将来 ADR-8 AppConfig で外部化)。 */
export const DEFAULT_FACTORS: readonly ScoringFactor[] = [
  { name: 'base', weight: 1.0, value: (s) => clamp(s.base, 0.0, 1.0) },
  { name: 'impact', weight: 0.15, value: (s) => impactScore(s.impact) },
  { name: 'personal', weight: 0.5, value: (s) => saturateEngagement(s.engagement) },
];

/** article_scores の 3 列に対応する合成結果。 */
export interface ComposedScore {
  /** base_score: base シグナル (importance_score)。 */
  base: number;
  /** personal_score: 暗黙FB の正規化値 (0..1)。 */
  personal: number;
  /** total_score: 因子の重み付き総和 (0..1.65、ランキング用なので 1.0 上限なし)。 */
  total: number;
}

/** 因子を合成して article_scores 用の 3 値を返す。 */
export function composeScore(
  signals: ScoringSignals,
  factors: readonly ScoringFactor[] = DEFAULT_FACTORS,
): ComposedScore {
  let total = 0;
  for (const f of factors) total += f.weight * f.value(signals);
  return {
    base: clamp(signals.base, 0.0, 1.0),
    personal: saturateEngagement(signals.engagement),
    total,
  };
}
