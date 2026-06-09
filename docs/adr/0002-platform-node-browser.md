# ADR-0002: 配信プラットフォームを Tauri/Rust → Node/TS + ブラウザへ移行

- ステータス: **Accepted**
- 日付: 2026-06-09
- 関連: [ADR-0001](0001-redesign-baseline.md) の Tauri 前提を **supersede**（13 決定の内容自体は言語非依存で存続）

---

## Context

Tauri v2 + Rust 版が開発機で全方向に運用困難だった:

- cargo コンパイルが重い / WebView2 実行時が不安定 / exe 配布が面倒 / 環境構築で起動に至らない

バックエンドの責務（SQLite 永続化・常駐収集・LLM・CORS 制限 API への HTTP・credential 保管）は不可欠なため
「HTML だけ」では成立しない。Node v24 が既に動作し `pnpm` も実績がある点を活かし、**痛みの源泉である
Rust/Tauri ネイティブ・ツールチェーンを撤廃**して、最も安定・低保守な構成へ移す。

---

## 決定

**バックエンドを Node/TypeScript、フロントをブラウザ表示に統一する。**

| 領域 | 採用 |
|------|------|
| ランタイム | Node v24（native TS 実行・ビルドステップ不要） |
| サーバ | Fastify。`@fastify/static` で SPA(dist/) 配信 + `/api/*`(POST) + `/events`(SSE) を**単一ポート 5180** |
| DB | **`node:sqlite`**（Node24 組込み・FTS5 動作・native 依存ゼロ）。migration は旧 `*.sql` を流用 |
| レンダラ | システムブラウザ（最も枯れている。WebView2 不安定が消える） |
| イベント | Tauri Channel/emit → **SSE**（`EventSource`） |
| credential | OS keyring → **AES-256-GCM 暗号化ローカルファイル**（scrypt 派生鍵、native 依存ゼロ） |
| 配布 | exe ビルド廃止 → ランチャ script（`launch/start-otakupulse.cmd`） |

### フロント seam（最小差分で切替）

- `src/lib/api.ts` — `invoke()` を `fetch('/api/<cmd>')` に置換（エラーは `{kind,message}` 互換）
- `src/lib/events.ts` — `listen()` を共有 `EventSource('/events')` に置換（Tauri 互換シグネチャ）
- `tauri-commands.ts` / hooks / App / AppShell / useSchedulerStore は import 差替のみ
- `@tauri-apps/api/*` はアプリコードから撤去

### 常駐収集と閲覧の分離

Node サーバが生きている限りブラウザ非依存で定期収集（45分毎 + 起動時）。
ブラウザは on-demand のビューア。Tauri ではウィンドウを開かないと収集が走らなかった課題を構造的に解消。

---

## Consequences

**Positive**
- Rust ツールチェーン由来の痛みが全消（コンパイル/環境構築/exe）。`tsc && vite build` 3.3s。
- 言語が TypeScript 1 本に統一（フロント・バックエンド共通）。
- 単一プロセス・単一ポートで SPA+API+SSE。`http://localhost:5180` を開くだけ。
- 移行の正味効果を Claude Preview で実描画検証（フィード/SSEトースト/console エラーゼロ）。

**Negative / トレードオフ**
- credential は OS keyring より弱い（暗号化ファイル + マシン派生鍵。単一ユーザーのローカル前提で許容）。
- CJK 全文検索は FTS5 unicode61 のまま（分かち書きせず。現状維持・退行なし。将来 trigram で改善）。
- 既存 Rust テスト資産は失効（vitest で dedup/impact パリティを再作成済、残りは順次）。
- フロントの単体テスト 6 本は `@tauri-apps/api` mock のため fetch mock へ要更新。

**移行ステータス（Phase A: A0–A4 完了）**
- A0 server scaffold + DB / A1 収集パイプライン / A2 全 ~70 コマンド / A3 フロント seam + ブラウザ動作 / A4 本書 + 確定。
- バックエンド全機能を実機検証（要約・deepdive・airing・clustering・pc_status 等）。

---

## 旧コードの扱い

- `src-tauri/`（Rust + Tauri）は **凍結**（参照用に残置、ビルド対象外）。削除はユーザー判断（破壊的操作のため自動実行しない）→ `src-tauri/DEPRECATED.md`。
- `docs/ARCHITECTURE.md` / `ROADMAP.md` / `LLM_STRATEGY.md` は Tauri/Rust 前提で陳腐化。本 ADR と ADR-0001 が優先。順次 realign。
- ADR-0001 の 13 決定（LlmRouter / 構造化出力 / RAG / IA 6→4 / evals / 観測性）は **Phase B** で TS 上に再ホームする。

## 既知の潜在バグ（A1 で発見・忠実移植・Phase B 修正対象）

- upsert が `is_duplicate`/`duplicate_of` を永続化せず dedup マークが no-op（現 Tauri 版と同挙動）。
- RssCollector が etag/Last-Modified を破棄し条件付き GET が無効。
