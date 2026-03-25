# CLAUDE.md — OtakuPulse プロジェクト固有ルール

<!-- 最終更新: 2026-03-19 -->

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

## 禁止事項

| 対象 | 禁止内容 | 理由 |
|------|----------|------|
| TypeScript | `console.log` | pino を使用 |
| TypeScript | `any` 型 | strict モード必須 |
| TypeScript | インラインスタイル | Tailwind CSS のみ |
| Rust | `unwrap()` in production | `?` 演算子 + AppError |
| Rust | `commands/` にビジネスロジック | services/ に分離 |

---

## デフォルト完了要件

以下すべてをパスして初めて「完了」と報告できる:

- [ ] `npm run check` — Biome lint/format エラーなし
- [ ] `npm run typecheck` — TypeScript 型エラーなし
- [ ] `cargo clippy -- -D warnings` — Clippy 警告なし
- [ ] `cargo test` — 全テストグリーン
