---
description: 外部データソース戦略 — AniList / Reddit / フィードライブラリの設計方針
globs: "src/**/*.{ts,tsx,rs}"
---

# 外部データソース戦略

## AniList GraphQL API — 30 req/min を前提に設計する

### 実態（2026年3月時点）

| 項目 | 公称値 | 実測値 |
|------|--------|--------|
| レートリミット | 90 req/min | **30 req/min** |
| X-RateLimit-Limit ヘッダ | 60 | 60（嘘） |
| 実際の制限発動 | — | **30 req で 429 返却** |

### 設計方針

- **30 req/min** を上限として設計する（公称値を信用しない）
- リクエスト間隔は最低 2秒 空ける
- `Retry-After` ヘッダに従ってリトライする
- 429 レスポンスを受けたら、指定秒数待機してからリトライ

```rust
const ANILIST_RATE_LIMIT: u32 = 30;        // req/min
const ANILIST_REQUEST_INTERVAL_MS: u64 = 2000;  // 2秒
```

### バッチ取得戦略

- 季節アニメ一覧: 1日1回のバッチ（50件/ページ × 2〜4ページ、2秒インターバル）
- 個別アニメ詳細: オンデマンド取得、キャッシュ有効期限 1時間
- `X-RateLimit-Remaining` は参考程度。残り 5 以下になったら自主スローダウン

---

## Reddit — .rss フィードを第一選択とする

### 方針

```
https://www.reddit.com/r/{subreddit}/.rss
```

- `feed-rs` クレートでパースする
- API 制限・認証を完全に回避できる
- User-Agent の設定のみ必要

### .json 方式（フォールバック）

- `infra/` に実装は残すが、デフォルトでは使用しない
- コメント数・投票数が必要な場合のみフォールバック

### OAuth は使用しない

2025年11月以降、Reddit は新規 OAuth トークンの取得を事実上困難にしている。
OtakuPulse では Reddit OAuth を一切使用しない。

---

## フィードライブラリ — rss-funnel は採用しない

### 却下理由

| 観点 | 問題 |
|------|------|
| ライセンス | GPL-3.0 — アプリ全体が GPL 汚染される |
| メンテナンス | 最終リリース 2024年8月（1年半以上放置） |
| 対応範囲 | RSS 専用 — AniList/Steam API に非対応 |
| 設定方式 | YAML 固定 — 動的フィード管理との相性が悪い |

### 採用ライブラリ（MIT）

- **feed-rs** — RSS/Atom フィードのパース
- **scraper** — HTML スクレイピング（OGP 取得等）

---

## scraper / custom-api（機能B）— 任意ソース収集の方針

ユーザーが任意 URL を登録できる `feed_type = 'scraper' | 'custom-api'` は、収集対象が
未知のため以下を**必須方針**とする（実装は `infra/scraper_fetcher.rs` / `services/collectors.rs`）。

| 観点 | 方針 |
|------|------|
| per-request timeout | 個別タイムアウトを必ず設定（既定 20s。共有 client 任せにしない） |
| 取得サイズ上限 | 本文は上限 5 MiB（`MAX_BODY_BYTES`）。`Content-Length` 超過は即拒否、無い場合もチャンク累積で監視し OOM を防ぐ |
| robots.txt | クロール対象サイトの robots.txt を尊重する（現状は方針記載のみ。User-Agent は明示する） |
| クロール間隔 | `fetch_interval_minutes` の下限を 5 分にクランプ（`add_custom_feed`）。短間隔の連続アクセスを禁止 |
| config 検証 | `feeds.config` JSON は **追加時**（`FeedType::validate_config`）と **収集時**（`parse_source_config`）で同一 serde 型を使い、追加時に即 `InvalidInput` を返す |

> AniList / Reddit が規約を明文化しているのと同様、汎用 scraper も無制限取得を避ける。
> feed_type の追加・変更は `services/collectors.rs` の `FeedType`（SSOT）と migration の CHECK 制約のみを
> 触り、両者の一致は `feed_type_matches_db_check` テストで保証する。

---

## PC/システム状態（機能A）— 記事化しない

`C:\Dashboard` のフレームワーク状態は **otaku news ではない**ため、article 収集パイプライン
（dedup / scoring / digest / LLM 要約）に載せない。`infra/dashboard_reader.rs` →
`services/pc_status_service.rs` → `get_pc_status` コマンドで read-only に取得し、Settings の
`SystemStatusSection` で表示する。`feed_type = 'pc-state'` は廃止。
