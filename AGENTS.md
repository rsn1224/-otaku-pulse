# AGENTS.md — OtakuPulse AI 協業ワークフロー

<!-- 最終更新: 2026-03-19 -->

## エージェント体制

```
Perplexity (設計相談役)
  └─ Design review, tech research, prompt quality check
  └─ No code changes
       ↓
Claude Code (アーキテクト・レビュアー)
  └─ Specs, design docs, HANDOFF.md creation
  └─ Post-implementation code review, test execution
       ↓
Cascade (リードエンジニア)
  └─ Implementation per HANDOFF.md
  └─ File creation/editing, build verification
       ↓
Claude Code (レビュアー)
  └─ Review results, issue reports
  └─ Correction prompt generation
```

---

## 基本ルール

1. **宛先を明記する** — プロンプトには必ず「Cascade 宛て」「クロードコード宛て」と明示する
2. **同一ファイル同時編集禁止** — Claude Code と Cascade が同じファイルを同時に触らない
3. **HANDOFF.md 先行** — Cascade に実装を依頼する前に、必ず HANDOFF.md を作成する
4. **レビュー必須** — Cascade の実装後は、必ず Claude Code でレビューする
5. **ステータス管理** — `pending` → `in-progress` → `review` → `done`

---

## 既知の落とし穴（Known Gotchas）

### Tauri v2

- **invoke() エラーは plain object** — `Error` インスタンスではない。`JSON.stringify(error)` または `error.message` で構造化アクセスする
- **snake_case → camelCase 変換** — Rust の引数名は snake_case だが、JS/TS の invoke 呼び出しでは camelCase にする
- **invoke_handler 登録漏れ** — コマンドを `invoke_handler` に登録し忘れると、ランタイムまでエラーが出ない（コンパイル時に検出不可）

### AniList API

- **レートリミット: 30 req/min** — 公称 90 req/min だが、2026年3月時点で 30 req/min に劣化中
- レスポンスヘッダ `X-RateLimit-Limit` は 60 と表示されるが、実際は 30 で制限される

### Reddit API

- **OAuth は使用しない** — 2025年11月以降、新規トークン取得が事実上困難
- `.rss` フィード（`https://www.reddit.com/r/{sub}/.rss`）を第一選択とする

---

## バグ報告テンプレート

```markdown
## バグ報告

### 現象
<!-- 何が起きたか -->

### 再現手順
1.
2.
3.

### 期待される動作
<!-- 本来どうなるべきか -->

### 実際の動作
<!-- 実際に何が起きたか -->

### 環境
- OS:
- Rust:
- Node:
- Tauri:

### ログ・スクリーンショット
<!-- 該当するものがあれば添付 -->
```

---

## Cascade 向け修正依頼プロンプトテンプレート

```markdown
## Cascade 宛て — レビュー指摘修正依頼

### 対象タスク
HANDOFF.md: #{タスク番号} — {タスク名}

### レビュー結果サマリ
- 全体評価: {A / B / C / D}
- 指摘件数: {N} 件

### 指摘一覧

#### 1. {指摘タイトル}
- **ファイル:** `{ファイルパス}`
- **行:** L{開始行}-L{終了行}
- **深刻度:** {critical / major / minor / nit}
- **内容:** {具体的な問題}
- **修正方針:** {どう直すか}

#### 2. {指摘タイトル}
...

### 修正完了条件
- [ ] 全指摘を修正
- [ ] `npm run check` パス
- [ ] `npm run typecheck` パス
- [ ] `cargo clippy -- -D warnings` パス
- [ ] `cargo test` パス

### 修正後
HANDOFF.md のステータスを `review` に戻してください。
```
