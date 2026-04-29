# CLAUDE.md — OtakuPulse プロジェクト固有ルール

<!-- 最終更新: 2026-04-13 -->

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

---

## 開発コマンド

```bash
# フロントエンド
pnpm dev             # Vite dev server
pnpm check           # Biome lint + format check
pnpm typecheck       # tsc --noEmit

# バックエンド (Rust / Tauri)
cargo check                      # コンパイルチェック
cargo clippy -- -D warnings      # Lint（警告はエラー扱い）
cargo test                       # テスト実行

# フルスタック
pnpm tauri dev       # Tauri + Vite 同時起動
```

---

## 4層アーキテクチャ（Rust バックエンド）

```text
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

- **状態管理:** 個別 `app.manage()` 必須。`Mutex<AppState>` 禁止 → `.claude/rules/tauri-v2-gotchas.md`
- **エラー型:** `AppError → { kind, message }` + `?` 演算子必須（実装は `src-tauri/src/error.rs`）
- **デザインシステム:** CSS 変数ベースのダークテーマ → `./design.md` + `.claude/rules/design-system.md`

---

## デザインシステム → `design.md` + `.claude/rules/design-system.md`

---

## ルール参照一覧（`.claude/rules/`）

<!-- 2026-04-07: 11ファイル → 5ファイルに統合済み。下記が実体 -->

| ファイル | 内容 |
|----------|------|
| `tauri-v2-gotchas.md` | Tauri v2 の落とし穴（`Mutex<AppState>` 禁止 / 個別 `manage()` パターン含む） |
| `api-data-sources.md` | AniList レート制限・Reddit RSS 優先・rss-funnel 却下理由 |
| `db-patterns.md` | `content_hash` 専用カラム・dedup Phase1 実行・スコアリング Phase 設計 |
| `typescript.md` | TypeScript / React 規約・Tauri invoke 集約・Zustand 分割 |
| `design-system.md` | CSS 変数命名・Legacy alias 移行・カスタム UI コンポーネント原則 |

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

- [ ] `pnpm check` — Biome lint/format エラーなし
- [ ] `pnpm typecheck` — TypeScript 型エラーなし
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
