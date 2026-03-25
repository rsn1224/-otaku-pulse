export interface ArticleRow {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  category: string;
  published_at: string | null;
  is_read: boolean;
  thumbnail_url: string | null;
}

export interface ArticleCluster {
  topic: string; // クラスター代表キーワード
  articles: ArticleRow[]; // グループ化された記事 (新しい順)
  representativeArticle: ArticleRow; // 最新記事
}

export interface ClusterResult {
  clusters: ArticleCluster[]; // 2 件以上のグループ
  standalone: ArticleRow[]; // グループ化されなかった記事
}

/**
 * タイトルの共有キーワードで記事をクラスタリング
 *
 * アルゴリズム:
 * 1. 各記事タイトルからキーワードを抽出 (extractKeywords)
 * 2. キーワードが 2 件以上の記事で共有 → クラスター形成
 * 3. representativeArticle = published_at が最新の記事
 */
export function clusterArticles(articles: ArticleRow[]): ClusterResult {
  // 各記事のキーワードを抽出
  const articleKeywords = new Map<number, string[]>();
  articles.forEach((article) => {
    articleKeywords.set(article.id, extractKeywords(article.title));
  });

  // キーワード → 記事IDリストのマップを作成
  const keywordToArticles = new Map<string, number[]>();
  articleKeywords.forEach((keywords, articleId) => {
    keywords.forEach((keyword) => {
      if (!keywordToArticles.has(keyword)) {
        keywordToArticles.set(keyword, []);
      }
      keywordToArticles.get(keyword)?.push(articleId);
    });
  });

  // 2件以上の記事で共有されるキーワードのみを抽出
  const validKeywords = new Map<string, number[]>();
  keywordToArticles.forEach((articleIds, keyword) => {
    if (articleIds.length >= 2) {
      validKeywords.set(keyword, [...articleIds]);
    }
  });

  // 記事ID → クラスターのマップを作成
  const articleToCluster = new Map<number, { topic: string; articles: number[] }>();
  validKeywords.forEach((articleIds, keyword) => {
    articleIds.forEach((articleId) => {
      // 既存のクラスターがあればより大きい方を採用
      const existing = articleToCluster.get(articleId);
      if (!existing || existing.articles.length < articleIds.length) {
        articleToCluster.set(articleId, { topic: keyword, articles: articleIds });
      }
    });
  });

  // クラスターを構築（重複防止のため topic ごとに ID Set を使用）
  const clusterMap = new Map<string, Set<number>>();
  for (const [, { topic, articles: articleIds }] of articleToCluster) {
    if (!clusterMap.has(topic)) {
      clusterMap.set(topic, new Set());
    }
    const idSet = clusterMap.get(topic);
    for (const id of articleIds) {
      idSet?.add(id);
    }
  }

  // クラスターを整形 (新しい順にソート)
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const clusters: ArticleCluster[] = [];
  for (const [topic, idSet] of clusterMap) {
    const clusterArticles = [...idSet]
      .map((id) => articleById.get(id))
      .filter((a): a is ArticleRow => a !== undefined);
    if (clusterArticles.length < 2) continue;
    clusterArticles.sort((a, b) => {
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
      return dateB - dateA;
    });

    clusters.push({
      topic,
      articles: clusterArticles,
      representativeArticle: clusterArticles[0],
    });
  }

  // クラスターに属さない記事を抽出
  const clusteredArticleIds = new Set<number>();
  clusters.forEach((cluster) => {
    cluster.articles.forEach((article) => {
      clusteredArticleIds.add(article.id);
    });
  });

  const standalone = articles.filter((article) => !clusteredArticleIds.has(article.id));

  return { clusters, standalone };
}

/**
 * タイトルからキーワードトークンを抽出 (純粋関数)
 *
 * 除去: 括弧とその中身、話数表現 (第N話, #N, ep.N)、記号、1-2 文字トークン、純数字
 * 例: "【速報】進撃の巨人 最終章 第89話" → ["進撃の巨人", "最終章"]
 */
export function extractKeywords(title: string): string[] {
  // 括弧とその中身を除去
  let cleaned = title.replace(/【[^】]*】/g, '');
  cleaned = cleaned.replace(/\([^)]*\)/g, '');
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '');

  // 話数表現を除去
  cleaned = cleaned.replace(/第\d+話/g, '');
  cleaned = cleaned.replace(/#\d+/g, '');
  cleaned = cleaned.replace(/ep\.\d+/g, '');
  cleaned = cleaned.replace(/episode\s*\d+/gi, '');

  // 記号をスペースに置換
  cleaned = cleaned.replace(/[！？｀～…―＆＃％＄＋＊＝｜／＜＞「」『』（）［］｛｝]/g, ' ');
  cleaned = cleaned.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~]/g, ' ');

  // 連続するスペースを単一化
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // トークンに分割
  const tokens = cleaned.split(' ');

  // フィルタリング
  const keywords = tokens.filter((token) => {
    // 1〜2文字トークンを除去
    if (token.length <= 2) return false;

    // 純数字を除去
    if (/^\d+$/.test(token)) return false;

    return true;
  });

  // 重複を除去して返す
  return [...new Set(keywords)];
}
