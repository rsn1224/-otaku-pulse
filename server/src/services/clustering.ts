import type { DatabaseSync } from 'node:sqlite';
import { all, get, run } from '../db/query.ts';
import { type DiscoverArticleDto, type DiscoverRow, toDiscoverArticleDto } from '../types/dto.ts';

// clustering_service.rs の移植（キーワード Jaccard + 時間近接 + フィード多様性）。
// NOTE: ADR-7（RAG / embedding クラスタリング）で再設計予定。

export interface ClusterGroup {
  clusterId: number;
  label: string;
  representative: DiscoverArticleDto;
  others: DiscoverArticleDto[];
  count: number;
}

const CLUSTER_THRESHOLD = 0.45;
const MIN_CLUSTER_SIZE = 3;
const CLUSTER_MAX_ARTICLES = 500;
const CLUSTER_EXPIRES_DAYS = 7;

const DISCOVER_COLS = `a.id, a.feed_id, a.title, a.url, a.summary, a.author,
  a.published_at, a.is_read, a.is_bookmarked, a.language, a.thumbnail_url, a.ai_summary,
  f.name AS feed_name, f.category AS category, a.impact_level,
  COALESCE(s.total_score, a.importance_score) AS total_score`;

function isCjk(cp: number): boolean {
  return (
    (cp >= 0x3000 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x20000 && cp <= 0x2a6df)
  );
}

function extractKeywords(text: string): Set<string> {
  const keywords = new Set<string>();
  const chars = Array.from(text);

  let i = 0;
  while (i < chars.length) {
    const cp = chars[i]?.codePointAt(0) ?? 0;
    if (isCjk(cp)) {
      let j = i + 1;
      while (j < chars.length && isCjk(chars[j]?.codePointAt(0) ?? 0)) j += 1;
      if (j - i >= 2) {
        const chunk = chars.slice(i, j);
        for (let k = 0; k < chunk.length - 1; k++) keywords.add(chunk[k]! + chunk[k + 1]!);
        keywords.add(chunk.join(''));
      }
      i = j;
    } else {
      i += 1;
    }
  }

  for (const word of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (word.length >= 3 && /^[a-z]+$/.test(word)) keywords.add(word);
  }
  return keywords;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0.0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0.0 : inter / union;
}

function timeProximity(a: string | null, b: string | null): number {
  const ta = a !== null ? Date.parse(a) : Number.NaN;
  const tb = b !== null ? Date.parse(b) : Number.NaN;
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0.5;
  const diffHours = Math.abs(ta - tb) / 3_600_000;
  return Math.min(1.0 / (1.0 + diffHours / 24.0), 1.0);
}

interface ArticleNode {
  id: number;
  feedId: number;
  title: string;
  publishedAt: string | null;
  keywords: Set<string>;
}

export function clusterArticles(db: DatabaseSync): number {
  const rows = all<{ id: number; feed_id: number; title: string; published_at: string | null }>(
    db,
    `SELECT id, feed_id, title, published_at FROM articles
     WHERE is_duplicate = 0 AND (published_at >= datetime('now', '-7 days') OR published_at IS NULL)
     ORDER BY published_at DESC LIMIT ?`,
    CLUSTER_MAX_ARTICLES,
  );
  if (rows.length < MIN_CLUSTER_SIZE) return 0;

  const nodes: ArticleNode[] = rows.map((r) => ({
    id: r.id,
    feedId: r.feed_id,
    title: r.title,
    publishedAt: r.published_at,
    keywords: extractKeywords(r.title),
  }));

  const assigned = new Set<number>();
  const clusters: number[][] = [];

  for (let i = 0; i < nodes.length; i++) {
    const ni = nodes[i]!;
    if (assigned.has(ni.id)) continue;
    const cluster = [i];
    assigned.add(ni.id);
    for (let j = i + 1; j < nodes.length; j++) {
      const nj = nodes[j]!;
      if (assigned.has(nj.id)) continue;
      const jac = jaccard(ni.keywords, nj.keywords);
      const time = timeProximity(ni.publishedAt, nj.publishedAt);
      const diversity = ni.feedId !== nj.feedId ? 0.2 : 0.0;
      if (jac * 0.5 + time * 0.3 + diversity >= CLUSTER_THRESHOLD) {
        assigned.add(nj.id);
        cluster.push(j);
      }
    }
    clusters.push(cluster);
  }

  run(db, 'DELETE FROM cluster_articles');
  run(db, 'DELETE FROM topic_clusters');

  const expiresAt = new Date(Date.now() + CLUSTER_EXPIRES_DAYS * 86_400_000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  let saved = 0;
  for (const clusterNodes of clusters) {
    if (clusterNodes.length < MIN_CLUSTER_SIZE) continue;
    const rep = nodes[clusterNodes[0]!]!;
    const label = Array.from(rep.title).slice(0, 20).join('');
    const category =
      get<{ category: string }>(
        db,
        'SELECT f.category FROM articles a JOIN feeds f ON f.id = a.feed_id WHERE a.id = ?',
        rep.id,
      )?.category ?? 'news';

    const res = run(
      db,
      'INSERT INTO topic_clusters (label, category, article_count, representative_article_id, expires_at) VALUES (?, ?, ?, ?, ?)',
      label,
      category,
      clusterNodes.length,
      rep.id,
      expiresAt,
    );
    const clusterId = Number(res.lastInsertRowid);

    for (const nodeIdx of clusterNodes) {
      const node = nodes[nodeIdx]!;
      const jac = jaccard(rep.keywords, node.keywords);
      const time = timeProximity(rep.publishedAt, node.publishedAt);
      run(
        db,
        'INSERT OR IGNORE INTO cluster_articles (cluster_id, article_id, similarity) VALUES (?, ?, ?)',
        clusterId,
        node.id,
        jac * 0.5 + time * 0.5,
      );
      run(db, 'UPDATE articles SET cluster_id = ? WHERE id = ?', String(clusterId), node.id);
    }
    saved += 1;
  }
  return saved;
}

export function getClusteredFeed(
  db: DatabaseSync,
  category: string | undefined,
  limit: number,
): ClusterGroup[] {
  const catFilter =
    category !== undefined && category !== '' && category !== 'all'
      ? `AND tc.category = '${category.replace(/'/g, "''")}'`
      : '';

  const clusterRows = all<{
    id: number;
    label: string;
    representative_article_id: number;
    article_count: number;
  }>(
    db,
    `SELECT tc.id, tc.label, tc.representative_article_id, tc.article_count
     FROM topic_clusters tc
     WHERE tc.expires_at > datetime('now') ${catFilter}
     ORDER BY tc.article_count DESC, tc.created_at DESC LIMIT ?`,
    limit,
  );

  const groups: ClusterGroup[] = [];
  for (const c of clusterRows) {
    const rep = get<DiscoverRow>(
      db,
      `SELECT ${DISCOVER_COLS} FROM articles a JOIN feeds f ON a.feed_id = f.id
       LEFT JOIN article_scores s ON a.id = s.article_id WHERE a.id = ?`,
      c.representative_article_id,
    );
    if (rep === undefined) continue;

    const others = all<DiscoverRow>(
      db,
      `SELECT ${DISCOVER_COLS} FROM articles a
       JOIN feeds f ON a.feed_id = f.id
       JOIN cluster_articles ca ON ca.article_id = a.id
       LEFT JOIN article_scores s ON a.id = s.article_id
       WHERE ca.cluster_id = ? AND a.id != ?
       ORDER BY ca.similarity DESC, a.published_at DESC LIMIT 4`,
      c.id,
      c.representative_article_id,
    );

    groups.push({
      clusterId: c.id,
      label: c.label,
      representative: toDiscoverArticleDto(rep),
      others: others.map(toDiscoverArticleDto),
      count: c.article_count,
    });
  }
  return groups;
}
