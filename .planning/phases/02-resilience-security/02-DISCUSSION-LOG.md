# Phase 2: Resilience & Security - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 02-resilience-security
**Areas discussed:** シャットダウン戦略

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| シャットダウン戦略 (推奨) | CancellationToken でどこまでキャンセルするか？ DB 書き込み完了待ち、進行中の HTTP リクエスト中断、5秒タイムアウトの扱い | ✓ |
| 設定ホットリロード範囲 | SchedulerConfig を Arc<RwLock> 化し Tauri event で通知する方針だが、どの設定変更を即時反映するか | |
| オフラインモードの振る舞い | API 不達時に 72h キャッシュで動作する方針だが、ユーザーへの通知方法、デグレード範囲、復帰検知 | |
| RSS エラーの可視化方法 | 壊れた RSS フィードを Settings で表示する方針だが、エラー表示の粒度、自動無効化ポリシー | |

---

## シャットダウン戦略

### Q1: アプリ終了時、進行中のフィード収集 HTTP リクエストをどうする？

| Option | Description | Selected |
|--------|-------------|----------|
| 即時キャンセル (推奨) | CancellationToken 発火で進行中の HTTP リクエストを即中断。取得途中の記事は破棄するが、DB には未書き込みのためデータ破損なし。5秒以内に終了可能 | ✓ |
| 現在のフィード完了待ち | 現在処理中の 1 フィードが完了するまで待つが、次のフィードには進まない。最大待機時間がフィードの応答速度に依存（reqwest タイムアウト30秒） | |
| タイムアウト付き待機 | 現在のフィードに 5 秒猶予を与え、それでも終わらなければ強制キャンセル | |

**User's choice:** 即時キャンセル (推奨)
**Notes:** なし

### Q2: DB 書き込み（insert_articles_batch）の扱いは？

| Option | Description | Selected |
|--------|-------------|----------|
| 完了待ち (推奨) | 進行中の DB 書き込みは必ず完了させる。WAL モードでもトランザクション完了を保証する | ✓ |
| 即時中断 OK | SQLite + WAL はロールバックでデータ整合性を保証するので、DB 書き込み中でも安全に中断可能 | |

**User's choice:** 完了待ち (推奨)
**Notes:** なし

### Q3: 5秒タイムアウトを超えた場合の最終手段は？

| Option | Description | Selected |
|--------|-------------|----------|
| tokio::runtime 強制終了 (推奨) | ランタイムをドロップしてプロセスを終了。Tauri のウィンドウ close イベントから 5 秒後に発動。プロセスがハングしないことを保証 | ✓ |
| ログ警告のみ | 5秒を超えてもログに警告を出すだけで、強制終了はしない。OS のプロセス終了に任せる | |

**User's choice:** tokio::runtime 強制終了 (推奨)
**Notes:** なし

### Q4: digest_loop（ダイジェスト生成）も同じ CancellationToken で停止する？

| Option | Description | Selected |
|--------|-------------|----------|
| 同一トークン (推奨) | collect_loop と digest_loop の両方で同じ CancellationToken を共有。アプリ終了時に 1 回の cancel() で全ループが停止。シンプル | ✓ |
| 個別トークン | 各ループに別々の CancellationToken を与え、個別に停止可能にする。将来的に「収集だけ停止」のような機能拡張ができるが、現時点では過剰 | |

**User's choice:** 同一トークン (推奨)
**Notes:** なし

---

## Claude's Discretion

- 設定ホットリロード範囲（RESL-02）
- RSS エラーの可視化方法（RESL-03）
- LLM プロバイダー切り替え安全化（RESL-04）
- オフラインモードの振る舞い（RESL-05）
- SEC-01 テスト追加方法
- SEC-02 サイズ制限値
- SEC-03 URL バリデーション実装

## Deferred Ideas

None
