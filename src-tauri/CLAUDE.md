# CLAUDE.md — Rust バックエンド層

<!-- src-tauri/ 配下のファイルを編集中に自動ロードされる -->

## 層の責務

```
src-tauri/src/
├── commands/   — 入口層。薄いラッパーのみ。ロジック禁止
├── services/   — ビジネスロジック。純粋関数中心。テスト対象
├── infra/      — 外部I/O（HTTP/DB/FS）。servicesからのみ呼ばれる
├── parsers/    — ステートレス変換のみ
├── models/     — データ型定義
└── error.rs    — AppError（thiserror）集中管理
```

## 重要ルール（詳細は `.claude/rules/` 参照）

- **`unwrap()` / `expect()` 禁止** — `?` 演算子 + `AppError` を必ず使う
- **層間跨ぎ禁止** — `commands → services → infra` の一方向依存のみ
- **非同期パターン** — CPUバウンド処理は `spawn_blocking`、Mutex保持中の `.await` 禁止
- **パフォーマンス** — `Vec::with_capacity`、`AHashMap`、`DashMap` 優先。詳細は `rust-perf.md`
- **ビルドプロファイル** — `cargo build --release` (`lto=fat`, `codegen-units=1`)、プロファイリングは `--profile profiling`

## コマンド

```bash
cargo check                      # コンパイルチェック
cargo clippy -- -D warnings      # リント（警告をエラー扱い）
cargo test                       # テスト
cargo build --release            # リリースビルド
cargo build --profile profiling  # フレームグラフ用
cargo clippy -- -W clippy::perf  # パフォーマンス警告
```

## 現在の依存関係メモ

- AniList: GraphQLクエリ (`graphql_client`) — Rate Limit 規則は `anilist_rate_limit.md` 参照
- Reddit: RSS優先、APIは後回し (`reddit_rss_first.md` 参照)
- SQLite: `sqlx` で管理。マイグレーションは `migrations/` 配下
- スケジューラー: `tokio-cron-scheduler` — `services/scheduler.rs` で管理
