# CLAUDE.md — OtakuPulse プロジェクト固有ルール

<!-- 最終更新: 2026-06-09 -->

> **プラットフォーム移行済み（[ADR-0002](docs/adr/0002-platform-node-browser.md)）**: Tauri/Rust → **Node/TS バックエンド + ブラウザ表示**。
> バックエンドは `server/`。旧 `src-tauri/`（Rust）は凍結（`src-tauri/DEPRECATED.md`）。起動: `launch/start-otakupulse.cmd` → http://localhost:5180。

## プロジェクト概要

**OtakuPulse** — AI パワードのオタクニュースアグリゲーター
スタック: **Node v24 + Fastify + node:sqlite**（backend, `server/`）/ React 19 + TypeScript + Tailwind CSS v4 + Zustand v5 + Biome v2（frontend, ブラウザ表示）

### Wings（画面構成）

現状は **6 Wings**。再設計で 4 Wings（Pulse / Digest / Library / Profile）へ統合予定 → `docs/adr/0001-redesign-baseline.md`（ADR-10）。

| Wing | 役割 |
|------|------|
| Discover | メインフィード（収集記事の閲覧・トレンド・for_you） |
| Digest | AI 要約・カテゴリ別ダイジェスト |
| Library | 購読フィード/ソース管理（OPML） |
| Saved | ブックマーク記事 |
| Schedule | 放送カレンダー（アニメ）・ゲーム発売日 |
| Profile | ユーザー設定・詳細設定 |

---

---

## 開発コマンド

```bash
# 起動（ランチャ）
launch\start-otakupulse.cmd   # 本番: SPA ビルド + Node サーバ + ブラウザ（単一ポート 5180）
launch\dev.cmd                # 開発: Vite(1420) + Node(5180, --watch)

# フロントエンド（リポジトリ root）
pnpm dev             # Vite dev server（1420、/api・/events を 5180 へ proxy）
pnpm check           # Biome lint + format check
pnpm typecheck       # tsc --noEmit
pnpm build           # tsc && vite build → dist/

# バックエンド（server/）
cd server && pnpm typecheck      # tsc --noEmit
cd server && pnpm test           # vitest（dedup/impact パリティ等）
cd server && node src/server.ts  # サーバ単体起動（Node24 native TS、ビルド不要）
```

---

## アーキテクチャ（Node バックエンド = `server/`）

```text
server/src/
├── routes/     — HTTP ハンドラ（Fastify）。薄いレイヤー、引数抽出 + service/db 委譲
├── services/   — ビジネスロジック（収集/scoring/dedup/digest/deepdive/summary 等）
├── db/         — node:sqlite クエリ + migrations（旧 *.sql 流用）。型付き query ヘルパ
├── infra/      — 外部 I/O（HTTP/AniList/Steam/RAWG/暗号化 credential）
├── llm/        — LLM クライアント（Ollama/Perplexity）+ settings
├── parsers/    — RSS/GraphQL/BBCode/scraper/OPML（ステートレス変換）
├── collectors/ — ソース別収集器
├── scheduler/  — 常駐収集ループ
└── events/     — EventEmitter → SSE
```

**ルール:**
- `routes/` にビジネスロジックを書かない。services/db を呼ぶだけ
- `services/` は `db/` `infra/` を経由（生の fetch/SQL を散らさない）
- `parsers/` はステートレスな変換のみ
- DB は `node:sqlite`（同期）。`db/query.ts` の型付き `all<T>/get<T>/run` 経由

---

## キーパターン

- **DB:** `node:sqlite`（同期・native 依存ゼロ）。FTS5 動作。`server/src/db/query.ts` の `all<T>/get<T>/run` 経由
- **エラー型:** `AppError(kind, message)`（`server/src/error.ts`）。FE には `{ kind, message }` で返す
- **イベント:** `server/src/events/bus.ts`（EventEmitter）→ SSE `/events`。FE は `src/lib/events.ts`（EventSource）
- **API 呼出:** FE は `src/lib/api.ts`（fetch）経由。`src/lib/tauri-commands.ts` が wrapper を集約
- **credential:** 暗号化ローカルファイル（`server/src/infra/credentials.ts`、AES-256-GCM）
- **デザインシステム:** CSS 変数ベースのダークテーマ → `./design.md` + `.claude/rules/design-system.md`

---

## デザインシステム → `design.md` + `.claude/rules/design-system.md`

---

## ルール参照一覧（`.claude/rules/`）

<!-- 2026-04-07: 11ファイル → 5ファイルに統合済み。下記が実体 -->

> 移行注記（ADR-0002）: `tauri-v2-gotchas.md`（Rust）は **凍結参照**。`api-data-sources.md`（AniList レート制限/Reddit RSS/scraper 上限）・`db-patterns.md`（content_hash 専用カラム/dedup）は **概念が `server/`(TS) に移植済み**で有効。`typescript.md` / `design-system.md` はそのまま適用。

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

- [ ] `pnpm typecheck`（frontend）/ `cd server && pnpm typecheck`（backend）— 型エラーなし
- [ ] `pnpm check` — Biome lint/format エラーなし（frontend）
- [ ] `cd server && pnpm test` — vitest グリーン
- [ ] `pnpm build` — SPA ビルド成功（UI/型に触れた場合）

> Rust ゲート（cargo clippy/test）は廃止（src-tauri 凍結、ADR-0002）。

---

## 禁止事項

| 対象 | 禁止内容 | 理由 |
|------|----------|------|
| TypeScript | `console.log`（FE 本番） | pino を使用 |
| TypeScript | `any` 型 | strict モード必須 |
| TypeScript | インラインスタイル | Tailwind CSS のみ |
| backend(TS) | `routes/` にビジネスロジック | services/db に分離 |
| 全般 | `src-tauri/`(Rust) の新規変更 | 凍結済み（ADR-0002）。backend は `server/` |
