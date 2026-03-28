---
created: 2026-03-28T14:06:36.581Z
title: "アプリ全体のデータ取得パフォーマンス最適化"
area: general
files:
  - src-tauri/src/commands/
  - src-tauri/src/services/
  - src-tauri/src/infra/
  - src/stores/
---

## Problem

Tauriコマンド呼び出しやフィード取得の応答時間が遅い。アプリ全体のデータ取得レイヤー（commands → services → infra）およびフロントエンドのストア更新において、ボトルネックの特定と最適化が必要。

## Solution

TBD — まずプロファイリングで具体的なボトルネックを特定してから方針を決定する。

検討候補:
- Rust 側: `cargo flamegraph` でホットパス可視化、SQLx クエリの N+1 問題チェック
- フロント側: React DevTools Profiler で再レンダリング頻度確認
- IPC: invoke 呼び出し回数の削減、バッチ化の検討
- キャッシュ: HTTP レスポンスキャッシュ、DB クエリ結果のメモ化
