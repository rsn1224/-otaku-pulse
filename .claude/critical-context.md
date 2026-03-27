# OtakuPulse — Critical Context

## アーキテクチャ
- 4 Wings: Dashboard, Feed, Digest, Settings
- Frontend: React 19 + Zustand v5 + Tailwind v4
- Backend: 4層 Rust（commands → services → infra → parsers）
- Mutex<AppState> 禁止 → 個別 manage() を使う

## 絶対ルール
- AniList API レートリミット遵守（90req/min）
- RSS フィード直接パース（RSS Funnel 使用禁止）
- Reddit は RSS-first アプローチ
- content_hash カラムで重複記事検出
- 日本語で回答、計画を提示してから実装
