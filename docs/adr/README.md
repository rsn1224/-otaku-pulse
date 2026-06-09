# Architecture Decision Records (ADR)

OtakuPulse の設計決定を記録する正典ディレクトリ。

## 運用ルール

- 1 つの ADR = 1 つ以上の確定した設計決定。受理後は **不変**（変更は新しい ADR で supersede）。
- ファイル名: `NNNN-kebab-title.md`（連番）。
- ステータス: `Proposed` / `Accepted` / `Superseded by NNNN` / `Deprecated`。
- 既存の `docs/*.md`（ARCHITECTURE / ROADMAP / LLM_STRATEGY 等）と矛盾する場合、**ADR が優先**する。旧 docs は各実装フェーズで ADR に合わせて realign する。

## 一覧

| ADR | タイトル | ステータス |
|-----|----------|-----------|
| [0001](0001-redesign-baseline.md) | 最新基準ゼロベース再設計ベースライン（13 決定） | Accepted (2026-06-09) |
| [0002](0002-platform-node-browser.md) | 配信プラットフォーム Tauri/Rust → Node/TS + ブラウザ | Accepted (2026-06-09) |

## 背景

`docs/ARCHITECTURE.md`・`ROADMAP.md`・`LLM_STRATEGY.md` は 2026-03 時点の初期設計で、現行実装から大きく乖離している
（services 名・LLM プロバイダ・Wings 構成・stores 数すべて）。本 ADR 群はこの乖離を解消し、
「最新基準での再設計」の確定方針を単一の正典として固定するために作成された。
