# Requirements: OtakuPulse Stabilization & Optimization

**Defined:** 2026-03-27
**Core Value:** 既存機能が正しく・速く・安全に動作すること

## v1 Requirements

### Error Handling & Safety

- [x] **SAFE-01**: setup コードの panic を構造化エラーに置換し、起動失敗時にユーザーにメッセージを表示する
- [x] **SAFE-02**: Mutex/RwLock の lock poisoning を AppError::Internal で処理し、expect() を排除する
- [x] **SAFE-03**: DeepDive キャッシュの unwrap_or_default を警告ログ付きエラーハンドリングに改善する
- [x] **SAFE-04**: personal_scoring の JSON デシリアライズに入力検証を追加し、破損時に AppError::InvalidInput を返す

### Bug Fixes

- [x] **BUG-01**: URL クエリパラメータの順序に依存しない dedup を実装する（全パラメータのソート統一）
- [x] **BUG-02**: DeepDive キャッシュに summary_hash + TTL（24h）を追加し、サマリー変更時にキャッシュを無効化する
- [x] **BUG-03**: dedup の Unicode 正規化を NFC → NFKC に統一し、半角カタカナ・互換文字を正しく処理する
- [x] **BUG-04**: rate_limiter のトークンカウンタを u32 → f64 に変更し、端数トークンの喪失を防ぐ

### Security

- [ ] **SEC-01**: Perplexity API キーがエラーログに出力されないことを監査し、テストで検証する
- [ ] **SEC-02**: user profile JSON に DB レベルのサイズ制限（CHECK 制約）と UI 入力制限を追加する
- [ ] **SEC-03**: OPML インポート時に URL バリデーション（http/https スキーム、有効なホスト名）を実施する

### Performance

- [x] **PERF-01**: SQLite に WAL モードを設定し、読み書きの並行実行を可能にする
- [ ] **PERF-02**: digest_loop の4カテゴリ処理を tokio::join! で並列化し、カテゴリ毎にタイムアウトを設定する
- [ ] **PERF-03**: personal_scoring の3回の DB クエリを1回の LEFT JOIN クエリに統合する
- [ ] **PERF-04**: FTS 検索にサブクエリ内 LIMIT/OFFSET を追加し、全件メモリロードを回避する
- [ ] **PERF-05**: highlights の N+1 クエリを GROUP BY + 単一クエリに書き換える
- [ ] **PERF-06**: URL 正規化を rayon::par_iter() で並列化する（500+ 記事のフィード向け）

### Resilience

- [x] **RESL-01**: scheduler の collect_loop / digest_loop に CancellationToken を導入し、グレースフルシャットダウンを実装する
- [x] **RESL-02**: SchedulerConfig を Arc<RwLock> でラップし、設定変更を Tauri event で稼働中ループに即時通知する
- [x] **RESL-03**: RSS パースエラーを (成功記事, 失敗記事, エラー) のタプルで返し、フィードエラーを可視化する
- [x] **RESL-04**: LLM プロバイダー切り替え時に進行中の DeepDive 会話を保護する（プロバイダー ID 検証）
- [x] **RESL-05**: オフラインモードを実装し、API 不達時にキャッシュ済みコンテンツ（72h TTL）で動作する

### Test Coverage

- [ ] **TEST-01**: dedup_service の包括テストスイートを作成する（20+ ケース: Unicode, URL 正規化, content hash）
- [ ] **TEST-02**: rate_limiter のストレステストを作成する（並行リクエスト, 429 ハンドリング, トークン枯渇）
- [ ] **TEST-03**: scheduler の CancellationToken によるシャットダウンテストを作成する
- [ ] **TEST-04**: personal_scoring のエッジケーステストを作成する（空プロフィール, 72h 超記事, ボーナス上限）
- [ ] **TEST-05**: TypeScript hook（useTauriCommand, useTauriQuery）のエラーハンドリングテストを作成する
- [ ] **TEST-06**: React コンポーネントの部分データレンダリングテストを作成する（null サマリー, 画像ロード失敗）
- [ ] **TEST-07**: cargo-llvm-cov と @vitest/coverage-v8 によるカバレッジインフラを導入する

### Dependencies

- [x] **DEP-01**: feedrs のバージョンを固定し、代替クレート（rss, atom_syndication）を評価する
- [x] **DEP-02**: reqwest のバージョンを固定し、各外部 API の統合テストを追加する
- [x] **DEP-03**: sqlx のオフラインモード（.sqlx/ ディレクトリ）を設定し、CI ビルドを安定化する

### Frontend Consistency

- [x] **FRNT-01**: articleFilter のフィルタリングロジックを Rust バックエンドに移動し、フロント/バック間の重複を解消する

## v2 Requirements

### Advanced Monitoring

- **MON-01**: lock 競合メトリクスの収集と表示
- **MON-02**: フィード別の成功/失敗率ダッシュボード

### Cache Intelligence

- **CACH-01**: DeepDive キャッシュの LRU eviction（500 エントリ上限）
- **CACH-02**: URL 正規化結果のキャッシュ

## Out of Scope

| Feature | Reason |
|---------|--------|
| 新規 Wing の追加 | 安定化マイルストーン — 既存機能の品質向上に集中 |
| 新しい API ソースの追加 | 既存ソースの安定化が優先 |
| UI デザインの大幅変更 | 機能的改善のみ |
| circuit breaker ライブラリ導入 | 4 API ソース程度ではオーバーエンジニアリング |
| テレメトリ / Sentry 導入 | デスクトップアプリのプライバシー懸念 |
| OAuth / ユーザー認証 | デスクトップアプリで不要 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SAFE-01 | Phase 1 | Complete |
| SAFE-02 | Phase 1 | Complete |
| SAFE-03 | Phase 1 | Complete |
| SAFE-04 | Phase 1 | Complete |
| BUG-01 | Phase 1 | Complete |
| BUG-02 | Phase 1 | Complete |
| BUG-03 | Phase 1 | Complete |
| BUG-04 | Phase 1 | Complete |
| PERF-01 | Phase 1 | Complete |
| DEP-01 | Phase 1 | Complete |
| DEP-02 | Phase 1 | Complete |
| DEP-03 | Phase 1 | Complete |
| FRNT-01 | Phase 1 | Complete |
| RESL-01 | Phase 2 | Complete |
| RESL-02 | Phase 2 | Complete |
| RESL-03 | Phase 2 | Complete |
| RESL-04 | Phase 2 | Complete |
| RESL-05 | Phase 2 | Complete |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| SEC-03 | Phase 2 | Pending |
| PERF-02 | Phase 3 | Pending |
| PERF-03 | Phase 3 | Pending |
| PERF-04 | Phase 3 | Pending |
| PERF-05 | Phase 3 | Pending |
| PERF-06 | Phase 3 | Pending |
| TEST-01 | Phase 3 | Pending |
| TEST-02 | Phase 3 | Pending |
| TEST-03 | Phase 3 | Pending |
| TEST-04 | Phase 3 | Pending |
| TEST-05 | Phase 3 | Pending |
| TEST-06 | Phase 3 | Pending |
| TEST-07 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap creation*
