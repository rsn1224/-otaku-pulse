# CLAUDE.md — OtakuPulse プロジェクト固有ルール

<!-- 最終更新: 2026-03-27 -->

## プロジェクト概要

**OtakuPulse** — AI パワードのオタクニュースアグリゲーター
スタック: Tauri v2 + Rust + React 19 + TypeScript + Tailwind CSS v4 + Zustand v5 + Biome v2

### 4 Wings（画面構成）

| Wing | 役割 |
|------|------|
| Dashboard | ホーム画面・概要表示 |
| Feed | ニュースフィード一覧・閲覧 |
| Digest | AI 要約・ダイジェスト生成 |
| Settings | ユーザー設定・フィード管理 |

---

## 🤖 メタ認知と自己最適化ルール

> このセクションは Claude Code 自身の「振る舞い」を定義する。言語固有のルールは `.claude/rules/` を参照。

### 1. Plan before Execute（計画の提示）
コードの変更や大規模な探索を始める前に、必ず関連ファイルを `grep` / `find` で最小限に調査し、**ステップバイステップの実行計画を日本語で提示**してから着手すること。

### 2. Context Economy（文脈の節約）
巨大なファイルを一度に全読み込みしない。関数単位の抽出やピンポイント検索を駆使し、コンテキストウィンドウ消費を最小限に抑えること。

### 3. Self-Critique（自己評価と方針転換）
- 同じエラーを **2回** 繰り返した場合
- ツール呼び出しが **5回以上** 連続で解決に結びつかない場合

→ 直ちに手を止め、別アプローチを日本語で提案すること。ハックで乗り切ろうとしない。

### 4. Progressive Disclosure（ルールの外部化）
`CLAUDE.md` を肥大化させない。新しい知見・パターンを発見したら `.claude/rules/` 配下の該当ファイルに追記し、このファイルには参照リンクのみ残す。

### 5. Reflection Trigger（自動振り返り）
タスク完了後、以下のキーワードが会話に含まれていたら自動的に振り返りを実行する:
- 「完了」「finish」「done」「LGTM」
→ `.claude/rules/` の該当ファイルに学びを追記すること（詳細は `.claude/agents/reflector.md` 参照）。

---

## 開発コマンド

```bash
# フロントエンド
npm run dev          # Vite dev server
npm run check        # Biome lint + format check
npm run typecheck    # tsc --noEmit

# バックエンド (Rust / Tauri)
cargo check                      # コンパイルチェック
cargo clippy -- -D warnings      # Lint（警告はエラー扱い）
cargo test                       # テスト実行

# フルスタック
npm run tauri dev    # Tauri + Vite 同時起動
```

---

## 4層アーキテクチャ（Rust バックエンド）

```
src-tauri/src/
├── commands/    — Tauri コマンド（#[tauri::command]）。薄いレイヤー、ロジック禁止
├── services/    — ビジネスロジック。テスト可能な純粋関数中心
├── infra/       — 外部 I/O（HTTP, DB, ファイルシステム）
└── parsers/     — フィード・BBCode パーサー（feed-rs ラッパー等）
```

**ルール:**
- `commands/` にビジネスロジックを書かない。services/ を呼ぶだけ
- `services/` は外部 I/O に直接依存しない。infra/ を経由する
- `parsers/` はステートレスな変換のみ

---

## キーパターン

### 状態管理: 個別 manage()（Mutex<AppState> 禁止）

```rust
// OK: 個別に管理
app.manage(db_pool);           // SqlitePool
app.manage(http_client);       // Arc<reqwest::Client>
app.manage(scheduler_handle);  // Arc<JobScheduler>

// NG: 一括 Mutex
// app.manage(Mutex::new(AppState { ... }))
```

→ 詳細は `.claude/rules/state_no_mutex.md` 参照

### エラー型: AppError → { kind, message }

```rust
// AppError は serde::Serialize を実装し、以下の形式でフロントに返す
// { "kind": "NotFound", "message": "Feed not found" }
```

### エラーハンドリング: `?` 演算子必須

```rust
// OK
let data = fetch_feed(url).await?;

// NG — 本番コードでの unwrap() 禁止
let data = fetch_feed(url).await.unwrap();
```

---

## ルール参照一覧（`.claude/rules/`）

| ファイル | 内容 |
|----------|------|
| `state_no_mutex.md` | Tauri state 管理パターン |
| `tauri-v2-gotchas.md` | Tauri v2 の落とし穴 |
| `anilist_rate_limit.md` | AniList API レート制限対応 |
| `no_rss_funnel.md` | RSS ファンネル禁止の背景 |
| `reddit_rss_first.md` | Reddit RSS 優先ルール |
| `content_hash_column.md` | content_hash カラム設計 |
| `scoring_phase1.md` | スコアリング Phase 1 設計 |
| `rust-perf.md` | Rust パフォーマンスチューニング |
| `typescript.md` | TypeScript / React 規約 |

## エージェント参照一覧（`.claude/agents/`）

| ファイル | 役割 |
|----------|------|
| `rust-reviewer.md` | Rust コードレビュー専門 |
| `ts-reviewer.md` | TypeScript/React コードレビュー専門 |
| `test-writer.md` | テストコード自動生成 |
| `reflector.md` | セッション終了時の振り返り・知見蓄積 |

---

## デフォルト完了要件

以下すべてをパスして初めて「完了」と報告できる:

- [ ] `npm run check` — Biome lint/format エラーなし
- [ ] `npm run typecheck` — TypeScript 型エラーなし
- [ ] `cargo clippy -- -D warnings` — Clippy 警告なし
- [ ] `cargo test` — 全テストグリーン

---

## 禁止事項

| 対象 | 禁止内容 | 理由 |
|------|----------|------|
| TypeScript | `console.log` | pino を使用 |
| TypeScript | `any` 型 | strict モード必須 |
| TypeScript | インラインスタイル | Tailwind CSS のみ |
| Rust | `unwrap()` in production | `?` 演算子 + AppError |
| Rust | `commands/` にビジネスロジック | services/ に分離 |
