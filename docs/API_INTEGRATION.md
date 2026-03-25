# API 統合仕様書 — OtakuPulse

<!-- 最終更新: 2026-03-19 -->

> 本ドキュメントは OtakuPulse が利用する外部 API の仕様・制約・設計方針をまとめたものである。
> 実装時は必ず本書の制約に従うこと。

---

## 目次

1. [AniList GraphQL API](#1-anilist-graphql-api)
2. [Steam ISteamNews API](#2-steam-isteamnews-api)
3. [Reddit — 重大な制約変更](#3-reddit--重大な制約変更)
4. [RSS 汎用](#4-rss-汎用)
5. [共通エラーハンドリングポリシー](#5-共通エラーハンドリングポリシー)

---

## 1. AniList GraphQL API

### 基本情報

| 項目 | 値 |
|------|-----|
| エンドポイント | `POST https://graphql.anilist.co` |
| 認証 | 公開データは **認証不要** |
| Content-Type | `application/json` |
| 通常レートリミット | 90 req/min |
| **現在の縮退状態** | **実効 30 req/min**（ヘッダーは 60 と返すが実際は 30 で 429 が発生） |
| バーストリミット | 短時間の集中リクエストに対して別途制限あり |
| 利用規約 | 非商用は無料。**データの大量蓄積（hoarding）は禁止**。ニュースリーダー用途は競合しない |

### レスポンスヘッダー

| ヘッダー | 説明 |
|----------|------|
| `X-RateLimit-Limit` | 1分あたりの許可リクエスト数（現在 60 と返るが信用しないこと） |
| `X-RateLimit-Remaining` | 残りリクエスト数 |
| `Retry-After` | 429 時のリトライ待機秒数 |

### 設計方針

- **常に 30 req/min を前提として設計する**（公称値を信用しない）
- 季節アニメ取得: 1日1回のバッチ取得（50 items/page × 数ページで完結）
- トレンドデータ: 6時間に1回程度で十分
- クエリは `graphql_client` クレートで型安全に定義する

### サンプルクエリ — 季節アニメ取得

```graphql
query SeasonalAnime($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
    }
    media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        medium
      }
      description(asHtml: false)
      episodes
      status
      averageScore
      genres
      startDate {
        year
        month
        day
      }
      nextAiringEpisode {
        airingAt
        episode
      }
      siteUrl
    }
  }
}
```

### サンプルクエリ — トレンドマンガ取得

```graphql
query TrendingManga($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
    }
    media(type: MANGA, sort: TRENDING_DESC) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        medium
      }
      description(asHtml: false)
      chapters
      volumes
      status
      averageScore
      genres
      siteUrl
    }
  }
}
```

### Rust 実装例 — graphql_client による型安全クエリ

```rust
use graphql_client::GraphQLQuery;

#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "graphql/anilist_schema.graphql",
    query_path = "graphql/seasonal_anime.graphql",
    response_derives = "Debug, Clone, Serialize, Deserialize"
)]
pub struct SeasonalAnimeQuery;

#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "graphql/anilist_schema.graphql",
    query_path = "graphql/trending_manga.graphql",
    response_derives = "Debug, Clone, Serialize, Deserialize"
)]
pub struct TrendingMangaQuery;
```

---

## 2. Steam ISteamNews API

### 基本情報

| 項目 | 値 |
|------|-----|
| エンドポイント | `GET https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/` |
| 認証 | API キー推奨（なしでも動作するがリミットが厳しい） |
| レートリミット | 公称 100,000 req/day |
| **既知の問題** | 2025年後半からグローバルで 429 が頻発。公称値は信用できない |

### リクエストパラメータ

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `appid` | **必須** | Steam アプリ ID（例: `730` = CS2） |
| `count` | 任意 | 取得件数（デフォルト: 20） |
| `maxlength` | 任意 | 本文最大長。`0` で全文取得 |
| `format` | 任意 | `json`（デフォルト）または `xml` |
| `feeds` | 任意 | フィード名フィルタ（カンマ区切り） |

### レスポンス本文の注意点

- ニュース本文は **BBCode 形式**で返される
- `[b]`, `[url=...]`, `[img]`, `[list]` などの BBCode タグをパースする必要がある
- **`parsers/steam_parser.rs`** に BBCode → 内部表現の変換ロジックを実装すること

### 429 対策

- **指数バックオフ**を必ず適用する
- 取得タイミングを **JST 2:00〜6:00**（Steam サーバー低負荷帯）に集中させる
- 監視対象のゲーム数が多い場合はキューイングして間隔を空ける

### リクエスト例

```
GET https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=10&maxlength=0&format=json
```

---

## 3. Reddit — 重大な制約変更

### 背景

**2025年11月以降、新規の OAuth トークン取得に事前承認が必要になった。**
個人開発での取得は極めて困難であり、OtakuPulse では OAuth を使用しない方針とする。

### アクセス方法の比較

| 方法 | 推奨度 | リミット | 実装難易度 | 備考 |
|------|--------|----------|-----------|------|
| RSS (`.rss`) | ★★★ **第一選択** | API リミットなし | 低 | 最も安定 |
| `.json` 末尾付与 | ★★☆ フォールバック | 10 req/min（IP ベース） | 低 | レート制限あり |
| OAuth | ★☆☆ 困難 | 100 req/min（承認済みの場合） | 高 | 事前承認が必要で現実的でない |

### 設計方針

#### 第一選択: RSS フィード

```
https://www.reddit.com/r/anime/.rss
https://www.reddit.com/r/manga/.rss
https://www.reddit.com/r/gaming/.rss
```

- パーサー: `feed-rs` クレート（後述）で統一的にパース
- Atom 形式で返される
- 取得間隔: 15分に1回で十分

#### フォールバック: .json エンドポイント

```
https://www.reddit.com/r/anime/hot.json?limit=25
https://www.reddit.com/r/manga/new.json?limit=25
```

- RSS でエラーが続く場合にのみ使用する
- IP ベースで 10 req/min の制限があるため注意

### User-Agent（必須）

Reddit はカスタム User-Agent を**強く要求**する。汎用 UA ではブロックされる。

```
OtakuPulse/1.0 (personal use; contact: {email})
```

> `{email}` は実際のメールアドレスに置き換えること。ハードコードは禁止（環境変数 or 設定ファイルから読み込む）。

---

## 4. RSS 汎用

### パーサー

| クレート | ライセンス | 説明 |
|---------|-----------|------|
| `feed-rs` | MIT | RSS 1.0 / RSS 2.0 / Atom / JSON Feed を統一的にパース |

`feed-rs` を採用することで、Reddit RSS・一般ニュースサイト・Atom フィードをすべて同一のパーサーで処理できる。

### レートリミット

- **1 req/sec/domain** を厳守する
- 同一ドメインへの連続リクエストは最低1秒の間隔を空けること

### キャッシュ戦略 — 条件付きリクエスト

HTTP キャッシュヘッダーを活用し、不要なデータ転送を削減する。

```text
初回リクエスト:
  GET /r/anime/.rss
  → 200 OK
  → ETag: "abc123"
  → Last-Modified: Thu, 19 Mar 2026 10:00:00 GMT

2回目以降:
  GET /r/anime/.rss
  If-None-Match: "abc123"
  If-Modified-Since: Thu, 19 Mar 2026 10:00:00 GMT
  → 304 Not Modified（データ未更新の場合 → パース処理をスキップ）
  → 200 OK（更新ありの場合 → 新データをパース）
```

### Rust 実装例 — 条件付きリクエスト

```rust
use reqwest::header::{HeaderMap, IF_MODIFIED_SINCE, IF_NONE_MATCH};

pub struct FeedCache {
    pub etag: Option<String>,
    pub last_modified: Option<String>,
}

pub async fn fetch_feed_with_cache(
    client: &reqwest::Client,
    url: &str,
    cache: &FeedCache,
) -> Result<Option<feed_rs::model::Feed>, FeedError> {
    let mut headers = HeaderMap::new();
    if let Some(ref etag) = cache.etag {
        headers.insert(IF_NONE_MATCH, etag.parse()?);
    }
    if let Some(ref last_mod) = cache.last_modified {
        headers.insert(IF_MODIFIED_SINCE, last_mod.parse()?);
    }

    let resp = client.get(url).headers(headers).send().await?;

    if resp.status() == reqwest::StatusCode::NOT_MODIFIED {
        return Ok(None); // キャッシュ有効 — パース不要
    }

    let bytes = resp.bytes().await?;
    let feed = feed_rs::parser::parse(&bytes[..])?;
    Ok(Some(feed))
}
```

### Anime News Network（ANN）に関する警告

- ANN は Cloudflare の Bot 保護下にあり、プログラムからのアクセスがブロックされる可能性が高い
- **優先度: 低** — 他のソースが安定してから検討する
- 対応する場合は Cloudflare のチャレンジ回避が必要になるため、工数が大きい

---

## 5. 共通エラーハンドリングポリシー

### タイムアウト

全 API 共通で **30 秒**のタイムアウトを設定する。

### リトライ戦略

| 条件 | リトライ回数 | バックオフ |
|------|------------|-----------|
| 一時的エラー (5xx, タイムアウト) | 3 回 | 指数バックオフ: 1s → 2s → 4s |
| 429 Too Many Requests | `Retry-After` に従う | ヘッダーがない場合は **60 秒**待機 |
| ネットワークエラー | ログ記録のみ | 次回スケジュールでリトライ |
| 4xx (429 以外) | リトライしない | エラーログを記録 |

### RateLimiter トレイト

`infra/` モジュールに共通のレートリミッターを実装し、全 API クライアントから利用する。

```rust
use std::time::Duration;

/// 全 API クライアントが実装すべきレートリミッタートレイト
#[async_trait::async_trait]
pub trait RateLimiter: Send + Sync {
    /// リクエスト送信前に呼び出す。リミットに達している場合は必要な時間だけ待機する。
    async fn acquire(&self) -> Result<(), RateLimitError>;

    /// レスポンスヘッダーからリミット情報を更新する。
    fn update_from_response(&self, headers: &reqwest::header::HeaderMap);

    /// 現在の残りリクエスト数を返す。
    fn remaining(&self) -> u32;

    /// リミットリセットまでの待機時間を返す。
    fn retry_after(&self) -> Option<Duration>;
}
```

### HTTP クライアント共通設定

```rust
use std::time::Duration;
use reqwest::Client;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_RETRIES: u32 = 3;
const INITIAL_BACKOFF: Duration = Duration::from_secs(1);
const BACKOFF_MULTIPLIER: u32 = 2;
const DEFAULT_429_WAIT: Duration = Duration::from_secs(60);

pub fn build_http_client(user_agent: &str) -> Result<Client, reqwest::Error> {
    Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .user_agent(user_agent)
        .build()
}

pub async fn request_with_retry<F, Fut, T>(
    rate_limiter: &dyn RateLimiter,
    request_fn: F,
) -> Result<T, ApiError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<reqwest::Response, reqwest::Error>>,
    T: serde::de::DeserializeOwned,
{
    let mut retries = 0;
    let mut backoff = INITIAL_BACKOFF;

    loop {
        rate_limiter.acquire().await?;

        match request_fn().await {
            Ok(resp) => {
                rate_limiter.update_from_response(resp.headers());

                match resp.status() {
                    status if status.is_success() => {
                        return resp.json::<T>().await.map_err(ApiError::from);
                    }
                    reqwest::StatusCode::TOO_MANY_REQUESTS => {
                        let wait = rate_limiter
                            .retry_after()
                            .unwrap_or(DEFAULT_429_WAIT);
                        tracing::warn!("429 received, waiting {:?}", wait);
                        tokio::time::sleep(wait).await;
                        // 429 はリトライ回数にカウントしない
                        continue;
                    }
                    status if status.is_server_error() && retries < MAX_RETRIES => {
                        retries += 1;
                        tracing::warn!(
                            "Server error {}, retry {}/{} after {:?}",
                            status, retries, MAX_RETRIES, backoff
                        );
                        tokio::time::sleep(backoff).await;
                        backoff *= BACKOFF_MULTIPLIER;
                    }
                    status => {
                        return Err(ApiError::HttpStatus(status));
                    }
                }
            }
            Err(e) if e.is_timeout() && retries < MAX_RETRIES => {
                retries += 1;
                tracing::warn!(
                    "Timeout, retry {}/{} after {:?}",
                    retries, MAX_RETRIES, backoff
                );
                tokio::time::sleep(backoff).await;
                backoff *= BACKOFF_MULTIPLIER;
            }
            Err(e) => {
                tracing::error!("Network error: {}", e);
                return Err(ApiError::Network(e));
            }
        }
    }
}
```

---

## API 別パラメータ早見表

| API | リミット（設計値） | 取得頻度 | 認証 | パーサー |
|-----|-------------------|---------|------|---------|
| AniList GraphQL | 30 req/min | 季節: 1回/日、トレンド: 1回/6h | 不要 | `graphql_client` |
| Steam ISteamNews | 保守的に運用 | JST 2-6時に集中 | API キー推奨 | `steam_parser.rs`（BBCode） |
| Reddit RSS | 制限なし | 15分に1回 | 不要 | `feed-rs` |
| Reddit .json | 10 req/min（IP） | フォールバックのみ | 不要 | `serde_json` |
| 一般 RSS | 1 req/sec/domain | ソースによる | 不要 | `feed-rs` |

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src-tauri/src/infra/rate_limiter.rs` | RateLimiter トレイト定義 |
| `src-tauri/src/infra/http_client.rs` | 共通 HTTP クライアント・リトライロジック |
| `src-tauri/src/parsers/steam_parser.rs` | BBCode パーサー |
| `src-tauri/graphql/*.graphql` | AniList クエリ定義ファイル |
| `src-tauri/src/sources/anilist.rs` | AniList API クライアント |
| `src-tauri/src/sources/steam.rs` | Steam API クライアント |
| `src-tauri/src/sources/reddit.rs` | Reddit RSS/JSON クライアント |
| `src-tauri/src/sources/rss.rs` | 汎用 RSS フェッチャー |
