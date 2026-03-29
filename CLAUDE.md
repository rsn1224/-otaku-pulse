# CLAUDE.md — OtakuPulse プロジェクト固有ルール

<!-- 最終更新: 2026-03-29 -->

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

### 6. Loop Monitoring（定期監視）
長時間タスク（ビルド監視、テスト反復、パフォーマンス計測）には `/loop` コマンドを活用する。
日常的な実装タスクでは不要。

### 7. Deep Reasoning（深い推論）
アーキテクチャ決定・複雑なデバッグ・設計レビューでは `ultrathink` を活用する。
日常的な実装タスクでは不要。

---

## LEARNED RULES（自動学習ルール — 最大10件、古い順にアーカイブ）

<!-- /session-end で自動追記。/self-improve で定期整理。10件超は .claude/rules/learned-archive.md へ -->
<!-- フォーマット: #### [YYYY-MM-DD] タイトル → NEVER/ALWAYS + なぜ + 例（3行以内） -->

（初期状態: 空 — セッション中の学習が自動蓄積される）

---

## ARCHITECTURAL DECISIONS（技術判断ログ — 最大5件）

<!-- 重要な技術判断時に追記。5件超は docs/adr/ に ADR として正式化 -->
<!-- フォーマット: #### [YYYY-MM-DD] 決定内容 → 選択 / 理由 / 却下案（4行以内） -->

（初期状態: 空 — プロジェクト全体に影響する判断のみ記録）

---

## SESSION CONTINUITY（セッション引き継ぎ）

<!-- /session-end で自動更新 -->

- **前回の作業**: （空）
- **次のステップ**: （空）
- **未解決の問題**: （空）
- **GSD 状態**: → `.planning/STATE.md` 参照

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

- **状態管理:** 個別 `app.manage()` 必須。`Mutex<AppState>` 禁止 → `.claude/rules/state_no_mutex.md`
- **エラー型:** `AppError → { kind, message }` + `?` 演算子必須 → `.claude/rules/error-patterns.md`
- **デザインシステム:** CSS 変数ベースのダークテーマ → `./design.md` + `.claude/rules/design-system.md`

---

## Design System

UI コンポーネントやスタイルに関する実装を行う際は、必ず `./design.md` を読み込み、
そのトークンとルールに厳密に従うこと。

- デザインワークフロー（Stitch / Figma MCP）は `~/.claude/rules/design-workflow.md` に従う
- プロジェクト固有のトークン変換表は `./design.md` の Stitch Token Mapping セクションを参照

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
| `error-patterns.md` | AppError 型・エラーハンドリングパターン |
| `design-system.md` | デザインシステム命名規約・禁止パターン |

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

<!-- GSD:project-start source:PROJECT.md -->
## Project

**OtakuPulse — Stabilization & Optimization**

AI パワードのオタクニュースアグリゲーター（Tauri v2 デスクトップアプリ）の安定化・最適化マイルストーン。新機能追加ではなく、既存機能の品質・パフォーマンス・テストカバレッジ・セキュリティを全面的に底上げする。

**Core Value:** **既存機能が正しく・速く・安全に動作すること。** ユーザーが気づかないバグや性能問題をゼロに近づけ、今後の機能追加に耐えるコードベースにする。

### Constraints

- **Tech stack**: 既存スタック維持（Tauri v2, Rust, React 19, TypeScript, SQLite）
- **Architecture**: 4層アーキテクチャを崩さない
- **Compatibility**: 既存の DB スキーマとの後方互換性を維持
- **Testing**: 変更には必ず対応テストを追加
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack
→ 詳細: `.planning/codebase/STACK.md` | 主要: Tauri v2.5 + Rust 2024 + React 19 + TS 5.8 + Tailwind v4 + Zustand v5 + Biome v2
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions
→ 詳細: `.planning/codebase/CONVENTIONS.md` | Biome v2, strict TS, named exports, pino logger, 4層分離
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture
→ 詳細: `.planning/codebase/ARCHITECTURE.md` | Commands→Services→Infra→Parsers, Zustand per-domain, AppError enum
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
