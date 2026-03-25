# フィードカタログ

<!-- 最終更新: 2026-03-25 -->

> OtakuPulse のデフォルトフィード一覧と選定理由を定義する。
> 4 カテゴリ（アニメ・マンガ・ゲーム・PC）で合計 18 フィードを提供する。

---

## 1. デフォルトフィード一覧

### アニメ（Anime）

| フィード名 | ソース種別 | URL | 取得間隔 | 備考 |
|-----------|-----------|-----|---------|------|
| AniList Seasonal | anilist | `https://anilist.co` (GraphQL API) | 1440 分 | 季節アニメの一括取得。1 日 1 回で十分 |
| コミックナタリー | rss | `https://natalie.mu/comic/feed/news` | 30 分 | アニメ・マンガの速報に強い国内最大級サイト |
| アニメ!アニメ! | rss | `https://animeanime.jp/rss/index.rdf` | 30 分 | アニメ専門ニュースサイト。独自取材あり |
| GIGAZINE | rss | `https://gigazine.net/news/rss_2.0/` | 60 分 | テック寄りだがアニメ・ゲーム記事も充実 |
| r/anime | rss | `https://www.reddit.com/r/anime/.rss` | 30 分 | 海外アニメコミュニティの話題を把握 |

### マンガ（Manga）

| フィード名 | ソース種別 | URL | 取得間隔 | 備考 |
|-----------|-----------|-----|---------|------|
| AniList Manga | anilist | `https://anilist.co` (GraphQL API) | 1440 分 | トレンドマンガの一括取得 |
| コミックナタリー（マンガ） | rss | `https://natalie.mu/comic/feed/news` | 30 分 | アニメカテゴリと同一フィード。カテゴリ分類で振り分け |
| r/manga | rss | `https://www.reddit.com/r/manga/.rss` | 30 分 | 新刊・新連載の海外反応を把握 |

### ゲーム（Game）

| フィード名 | ソース種別 | URL | 取得間隔 | 備考 |
|-----------|-----------|-----|---------|------|
| 4Gamer.net | rss | `https://www.4gamer.net/rss/index.xml` | 30 分 | 国内最大級のゲームニュースサイト |
| PC Gamer | rss | `https://www.pcgamer.com/rss/` | 60 分 | PC ゲーム専門。レビュー・ニュースが充実 |
| Gematsu | rss | `https://www.gematsu.com/feed` | 60 分 | 日本ゲームの英語圏向けニュース。速報性が高い |
| r/pcgaming | rss | `https://www.reddit.com/r/pcgaming/.rss` | 30 分 | PC ゲーマーコミュニティのトレンド |
| r/Steam | rss | `https://www.reddit.com/r/Steam/.rss` | 30 分 | Steam セール・新作情報の集約地 |

### PC ハードウェア（PC）

| フィード名 | ソース種別 | URL | 取得間隔 | 備考 |
|-----------|-----------|-----|---------|------|
| PC Watch | rss | `https://pc.watch.impress.co.jp/data/rss/1.0/pcw/feed.rdf` | 30 分 | 国内 PC ハードウェアニュースの定番 |
| Tom's Hardware | rss | `https://www.tomshardware.com/feeds/all` | 60 分 | 世界最大級の PC ハードウェアレビューサイト |
| GamersNexus | rss | `https://gamersnexus.net/rss.xml` | 60 分 | 高品質なベンチマーク・技術分析 |
| igor'sLAB | rss | `https://www.igorslab.de/en/feed` | 60 分 | GPU・PSU の詳細技術分析に定評 |
| r/hardware | rss | `https://www.reddit.com/r/hardware/.rss` | 30 分 | ハードウェアニュース・議論の集約 |

---

## 2. Reddit フィードに関する注意事項

### .rss 形式を採用する理由

Reddit の全フィードは **`.rss` 形式**（`/r/{subreddit}/.rss`）で取得する。

- **API レート制限の回避**: Reddit API（OAuth2）は認証が必要で、レート制限（60 req/min）が厳しい。RSS フィードはこの制限の対象外
- **認証不要**: API キーやトークンの管理が不要
- **十分なデータ量**: RSS には最新 25 投稿が含まれ、30 分間隔の取得で取りこぼしは極めて少ない

### .json フォールバック

`infra/` モジュールに `.json` 形式（`/r/{subreddit}/.json`）でのフォールバック実装が含まれるが、デフォルトでは使用しない。

```text
.rss 取得失敗時のフォールバックチェーン:
  1. .rss → 成功ならそのまま使用
  2. .json → .rss が 403/429 の場合に使用
  3. スキップ → 両方失敗なら次の取得サイクルまで待機
```

> **注意**: `.json` フォールバックを有効化する場合、`User-Agent` ヘッダーに適切なアプリ名を設定すること（Reddit のルール）。

---

## 3. Anime News Network（ANN）を含めない理由

**結論: ANN は Cloudflare のボット保護により RSS フィード取得が高確率でブロックされるため、デフォルトフィードには含めない。**

### 詳細

- ANN の RSS フィード（`https://www.animenewsnetwork.com/all/rss.xml`）は Cloudflare の保護下にある
- 自動取得（Bot からのアクセス）は 403 または CAPTCHA チャレンジが返される
- ヘッドレスブラウザを使った回避はメンテナンスコストが高く、利用規約に抵触する可能性がある

### 代替カバレッジ

ANN が提供するニュースの大部分は以下のソースでカバーできる:

| ANN の記事種別 | 代替ソース |
|---------------|-----------|
| アニメ新作発表 | AniList + コミックナタリー + r/anime |
| キャスト情報 | アニメ!アニメ! + r/anime |
| マンガニュース | コミックナタリー + r/manga |
| 業界ニュース | GIGAZINE + r/anime |

> ユーザーが手動で ANN フィードを追加することは可能。ただし取得失敗率が高い旨を UI 上で警告する。

---

## 4. マイグレーション SQL リファレンス

`001_initial.sql` にデフォルトフィードの INSERT 文を含める。

```sql
-- デフォルトフィード挿入
-- カテゴリ: anime
INSERT OR IGNORE INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('AniList Seasonal',  'https://graphql.anilist.co',                    'anilist', 'anime', 1440),
    ('コミックナタリー',    'https://natalie.mu/comic/feed/news',            'rss',     'anime', 30),
    ('アニメ!アニメ!',     'https://animeanime.jp/rss/index.rdf',           'rss',     'anime', 30),
    ('GIGAZINE',          'https://gigazine.net/news/rss_2.0/',            'rss',     'anime', 60),
    ('r/anime',           'https://www.reddit.com/r/anime/.rss',           'rss',     'anime', 30);

-- カテゴリ: manga
INSERT OR IGNORE INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('AniList Manga',           'https://graphql.anilist.co/manga',        'anilist', 'manga', 1440),
    ('コミックナタリー（マンガ）', 'https://natalie.mu/comic/feed/news/manga','rss',     'manga', 30),
    ('r/manga',                 'https://www.reddit.com/r/manga/.rss',     'rss',     'manga', 30);

-- カテゴリ: game
INSERT OR IGNORE INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('4Gamer.net',   'https://www.4gamer.net/rss/index.xml',              'rss', 'game', 30),
    ('PC Gamer',     'https://www.pcgamer.com/rss/',                      'rss', 'game', 60),
    ('Gematsu',      'https://www.gematsu.com/feed',                      'rss', 'game', 60),
    ('r/pcgaming',   'https://www.reddit.com/r/pcgaming/.rss',            'rss', 'game', 30),
    ('r/Steam',      'https://www.reddit.com/r/Steam/.rss',               'rss', 'game', 30);

-- カテゴリ: pc
INSERT OR IGNORE INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('PC Watch',      'https://pc.watch.impress.co.jp/data/rss/1.0/pcw/feed.rdf', 'rss', 'pc', 30),
    ('Tom''s Hardware','https://www.tomshardware.com/feeds/all',           'rss', 'pc', 60),
    ('GamersNexus',   'https://gamersnexus.net/rss.xml',                  'rss', 'pc', 60),
    ('igor''sLAB',    'https://www.igorslab.de/en/feed',                  'rss', 'pc', 60),
    ('r/hardware',    'https://www.reddit.com/r/hardware/.rss',            'rss', 'pc', 30);
```

> **注意**: コミックナタリーと AniList はアニメ・マンガで同一フィードだが、DB の `UNIQUE(url)` 制約のため URL を分けて登録している。記事のカテゴリ振り分けは services 層で行う。

### フィードの追加・削除

- ユーザーは UI から自由にフィードを追加・削除できる
- デフォルトフィードは `INSERT OR IGNORE` で初回のみ登録される
- ユーザーが削除した場合、再初期化で復元可能（設定画面から手動トリガー）

---

## 5. 取得間隔の設計方針

| 間隔 | 対象 | 理由 |
|------|------|------|
| 30 分 | ニュースサイト、Reddit | 速報性が重要。サーバー負荷も許容範囲内 |
| 60 分 | 海外レビューサイト | 更新頻度が低め。30 分は過剰 |
| 1440 分（24 時間） | AniList API | GraphQL API のレート制限を考慮。日次で十分 |

> 全フィードの取得間隔はユーザーが設定画面から個別に変更可能。最小値は 15 分に制限する（サーバー負荷防止）。
