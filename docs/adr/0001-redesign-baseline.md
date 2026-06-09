# ADR-0001: 最新基準ゼロベース再設計ベースライン

- ステータス: **Accepted**
- 日付: 2026-06-09
- 決定者: プロジェクトオーナー（設計セッションにて確定）

---

## Context

OtakuPulse は成熟したコードベース（14 migrations、クリーンな 4 層、Perplexity + Ollama の LLM trait 抽象、
personal scoring / impact 分類 / topic clustering / AniList・Steam 同期 / weekly report 実装済）を持つが、
以下の負債とドキュメント乖離がある:

- LLM クライアント生成が 3 箇所重複（`commands/digest.rs` / `commands/discover_ai.rs` / `services/scheduler.rs`）
- プロンプトが 5 ファイルに散在、`---FOLLOWUP---` delimiter による脆弱パース（`deepdive_helpers.rs`）
- スコアリングが `scoring_service`（base）と `personal_scoring`（暗黙FB）の二系統に分裂
- 構造化出力が Ollama のみ（Perplexity は自由文）、全 LLM が request-response（ストリーミング無し）
- 設定値（dedup 閾値 / interaction window / rayon 閾値 / pool=5）がハードコード
- フロントに ハードコード色 ~35 箇所・React.FC×5・inline style×3・light-mode class 残存
- metrics 不在（コスト・レイテンシ・dedup 率が不可視）
- ドキュメント乖離: CLAUDE.md は「4 Wings」だが実体は **6 Wings**、`docs/ARCHITECTURE/ROADMAP/LLM_STRATEGY` は 2026-03 の初期設計のまま

確定方針: **ゼロから書き直さず**、理想形アーキテクチャを定義し、現状とのギャップを段階移行する。

---

## 決定（13 ADR）

### ADR-1 — 型付き Domain EventBus
`tokio::sync::broadcast` ベースのイベントバス（`ArticleCollected` / `DedupCompleted` / `Scored` / `DigestReady` / `LlmStreamChunk`）を導入。
- **置換**: ad-hoc `app_handle.emit()` + FE ポーリング
- **帰結**: 状態伝播が型付き・一元化。FE は Tauri event / Channel で購読。4 層構造は維持。

### ADR-2 — 能力ルーティング LlmRouter
LLM クライアント生成の単一入口 `services/llm_router.rs`。`Task`（DeepDive/Digest/Summary/Search/QuestionGen）+ policy から必要 capability とコスト tier で provider 選択。プロバイダは **Perplexity（grounded/citation）/ Anthropic `claude-opus-4-8`（reasoning・digest）/ Ollama `qwen3:14b`（offline・低コスト）**。
- **置換**: 3 箇所の重複 build site、OpenAI フォールバック（LLM_STRATEGY.md）
- **帰結**: 設定スキーマ変更が 1 箇所に収束。

### ADR-3 — 構造化出力を全 LLM タスク必須化
各 task が JSON schema を定義。Perplexity=`response_format`、Claude=tool-use/structured、Ollama=`format`。
- **置換**: `---FOLLOWUP---` delimiter パースを削除
- **帰結**: 改行差・フォーマット揺れによる破綻を排除。Perplexity の `response_format` 対応は 2026-06 web 検証済。

### ADR-4 — versioned prompt registry + eval harness
inline プロンプトを `services/prompts/`（埋め込みテンプレ）へ集約し `prompt_id@version` で参照。`cargo test` で各 version を fixture に対し実行し構造化出力を assert（schema 妥当 / 必須 field / 長さ境界 / citation 有無）。
- **置換**: 5 ファイル散在の inline プロンプト
- **帰結**: LLM 出力品質の回帰検出が可能に。

### ADR-5 — AI 出力の Tauri Channel ストリーミング
provider に `stream()` を追加し `tauri::ipc::Channel<StreamChunk>` で FE 逐次配信。非対応 provider は single-chunk エミュレート。
- **置換**: request-response バッファ
- **帰結**: 長文 digest / deepdive の spinner 待ちを解消。Channel は Tauri v2 の大容量/逐次配信推奨 IPC（web 検証済）。

### ADR-6 — 単一 ScoringPipeline
`scoring_service`（base）と `personal_scoring`（暗黙FB）を `services/scoring_pipeline.rs` に統合。重み付き合成シグナル（freshness / keyword / content / 暗黙FB / impact）→ `importance_score` カラム。pluggable factor 設計。
- **置換**: スコアリング二系統
- **帰結**: 統一スコアと調整可能な重み。

### ADR-7 — RAG / セマンティック検索
dedup 後に新規記事の embedding を生成（Ollama embedding model）→ `article_embeddings` テーブル（or `sqlite-vec`）。semantic search / related articles / grounded deepdive の基盤。deepdive/search は top-k ローカル記事を context 注入し内部記事も引用可能化。
- **置換**: generic web 検索のみ
- **帰結**: ローカルコーパスに基づく回答とコスト削減。

### ADR-8 — AppConfig でマジックナンバー外部化
`services/app_config.rs` が settings KVS から型付きロード（既定値付き）: dedup 閾値・interaction window・rayon 閾値・pool size・retry policy。
- **置換**: ハードコード定数
- **帰結**: 再ビルド無しで調整可能。

### ADR-9 — feed 収集の指数バックオフ retry policy
連続失敗時に指数バックオフで再試行。
- **置換**: 3 連続失敗で無期限 auto-disable
- **帰結**: 一時障害からの自動回復。

### ADR-10 — IA 統合 6→4 Wings（intent 駆動）
| 新 Wing | 統合元 | 趣旨 |
|---------|--------|------|
| **Pulse** | Discover + Saved + Highlights | メインフィード。bookmark は view/filter 化 |
| **Digest** | Digest + Schedule（airing/release） | 時間軸オーバービュー集約 |
| **Library** | Library | 購読ソース管理（OPML） |
| **Profile** | Profile + 観測性ダッシュボード + 詳細設定 | 設定 + metrics 可視化 |
- **置換**: 有機成長した 6 Wings（Discover/Digest/Library/Saved/Schedule/Profile）
- **帰結**: 動線短縮。実装段階で微調整可。

### ADR-11 — design-system 規約を lint gate で恒久強制
ハードコード色・light-mode class・inline style・React.FC を lint gate（`~/.claude/scripts/qa/check-*.mjs` 活用）で検出。
- **置換**: 手動レビュー依存
- **帰結**: token 体系（良好）を維持しつつ違反 0 を保証。

### ADR-12 — React Compiler 1.0 採用
手動 memo を撤廃し最適化を compiler に委譲。
- **置換**: 手動 memoization
- **帰結**: コード簡素化。React Compiler 1.0 は 2025-10 GA（web 検証済）。

### ADR-13 — オブザーバビリティ
全 LLM 呼出で provider/model/tokens/latency/コスト推定/task を `llm_metrics` に記録、pipeline metrics（収集件数・dedup 率）と共に Profile に可視化。
- **置換**: `tracing` ログのみ
- **帰結**: コスト・性能の可観測化。

---

## Migration Roadmap

| Phase | 内容 | リスク | 主 ADR |
|-------|------|--------|--------|
| 0 | 設計凍結 + 本 ADR 記録 + CLAUDE.md Wings 修正 | なし | 全 |
| 1 | 基盤硬化（非破壊）: AppConfig・LlmRouter 統合・EventBus・design lint cleanup・React.FC/inline 撤去・React Compiler | 低 | 1,2,8,11,12 |
| 2 | LLM 近代化: 全タスク構造化出力・prompt registry・Claude provider・Channel streaming | 中 | 3,4,5 |
| 3 | データ知能化: unified scoring・RAG embeddings・embedding clustering・retry/backoff | 中 | 6,7,9 |
| 4 | IA 統合 + UI 刷新: 6→4 Wings・DiscoverCard 分解・streaming UI・観測性ダッシュボード | 中 | 10,13 |
| 5 | Evals + 観測性硬化: eval harness を CI 化・metrics dashboard 完成 | 低 | 4,13 |

各 Phase は独立マージ可能（Phase 1 は完全非破壊）。

---

## 旧ドキュメントの扱い

`docs/ARCHITECTURE.md`・`ROADMAP.md`・`LLM_STRATEGY.md` は本 ADR と矛盾する箇所が多い（初期設計のまま）。
本 ADR が優先。各旧 doc は対応フェーズの実装時に realign する（一括書き直しは行わない）。

| 旧 doc | 主な乖離 | realign フェーズ |
|--------|----------|-----------------|
| ARCHITECTURE.md | services 名・cloud LLM=OpenAI・stores 3個 | Phase 1〜4 |
| ROADMAP.md | 4 Wings・OpenAI fallback・`collectors/` dir | Phase 4 |
| LLM_STRATEGY.md | Qwen2.5 + OpenAI、Perplexity 不在、ストリーミング無し | Phase 2 |

---

## 検証

設計フェーズの検証 = 各 ADR が現状コードに照らして実装可能で、ギャップが実体と一致すること（本セッションで 3 並列 Explore により確認済）。
実装フェーズの受け入れ基準（各 Phase 末）: `pnpm check` / `pnpm typecheck` / `cargo clippy -- -D warnings` / `cargo test` グリーン。
Phase 2 以降は eval harness pass、Phase 4 は streaming deepdive の手動 E2E、design lint gate で違反 0。
