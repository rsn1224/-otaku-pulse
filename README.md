# OtakuPulse

Anime・漫画・ゲーム・PC ハードウェアの最新情報を自動収集し、Perplexity Discover 風 UI で届けるデスクトップアプリ。

![Version](https://img.shields.io/badge/version-2.1.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)

## Features

### Discover フィード
- **For You / Trending / カテゴリタブ** — AI スコアリングによるパーソナライズ
- **Today's Highlights** — AI が選定した注目記事と理由表示
- **インライン AI サマリー** — IntersectionObserver + DB キャッシュで遅延生成
- **DeepDive Q&A** — 記事ごとに質問を自動生成、Perplexity Sonar / Ollama で回答
- **Masonry グリッド** — 3 / 2 / 1 カラム レスポンシブレイアウト
- **サムネイル表示** — OGP / メディア自動抽出

### 収集エンジン
- **Auto-collection** — RSS / AniList / Steam / Reddit、設定したスケジュールで自動収集
- **3層重複排除** — URL 正規化 → タイトル Jaccard 類似度 → コンテンツハッシュ
- **フィード自動 disable** — 連続エラー 3 回で無効化

### コンテンツ管理
- **AI Digest** — Perplexity Sonar または Ollama によるカテゴリ別要約（毎朝 8:00 自動生成）
- **Airing Schedule** — 週間アニメ放送カレンダー（AniList API）
- **Saved Wing** — ブックマーク専用画面
- **Keyword Filters** — ミュート / ハイライトキーワード設定
- **FTS5 Search** — SQLite 全文検索 + LLM 回答 + 引用表示

### UX
- **Keyboard Navigation** — J/K で記事移動、O で開く、B でブックマーク、? でヘルプ
- **Onboarding Wizard** — 3 ステップ好み設定
- **好み提案** — 50 記事ごとに AI が行動履歴から好みを推定
- **Theme** — ダーク / ライト / システム切替
- **OS 通知** — 新着収集完了・ダイジェスト生成時に通知

## Requirements

- Windows 10 / 11
- (Optional) [Ollama](https://ollama.ai) — ローカル AI ダイジェスト生成

## Install

`OtakuPulse_2.1.0_x64-setup.exe` を実行。

## First-time Setup

1. アプリを起動
2. オンボーディングウィザードで好みのカテゴリを設定
3. Settings > AI プロバイダーを選択:
   - **Perplexity**: API キーを設定（[取得はこちら](https://console.perplexity.ai)）
   - **Ollama**: `ollama serve` + `ollama pull qwen2.5:7b` を実行
4. 「収集」ボタンで最新記事を取得

## Development

```bash
npm install
npm run tauri dev
```

### Release Build

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/nsis/OtakuPulse_2.1.0_x64-setup.exe`

### Quality Checks

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
npx tsc --noEmit
npx biome check src/
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Tailwind CSS v4 + Zustand |
| Backend | Rust + Tauri v2 + SQLx |
| Database | SQLite (FTS5 全文検索) |
| AI | Perplexity Sonar API / Ollama |
| Build | Vite + Biome |

## Changelog

### v2.1.0 (2026-03-26)
- P5-A: キーボードナビゲーション強化（J/K/O/M/B/?）
- P5-B: SAVED Wing（ブックマーク専用画面）
- P5-C: キーワードフィルタ（ミュート / ハイライト）
- P5-D: アニメ放送スケジュール Wing（AniList）
- P5-G: OS 通知統合（収集完了・ダイジェスト生成）
- P5-H: ダーク / ライト / システムテーマ切替
- Refactor: useFilterStore 導入、週ナビ fetch 連動

### v2.0.0 (2026-03-26)
- Perplexity Discover リデザイン全機能
- DeepDive Q&A、パーソナルスコアリング、Today's Highlights
- オンボーディングウィザード、好み提案
- Masonry グリッド、サムネイル表示
- v1 残骸 25+ ファイル削除、コマンド 64 → 44

### v1.0.0
- 収集エンジン（RSS / AniList / Steam / Reddit）
- AI Digest（Perplexity Sonar / Ollama）
- スケジューラ（自動収集・ダイジェスト）
- NEWS Wing / Digest Wing / Settings Wing

## License

MIT
