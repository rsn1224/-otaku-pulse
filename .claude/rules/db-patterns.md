---
description: DB 設計パターン — content_hash / dedup / scoring のルール
---

# DB 設計パターン

## content_hash は専用カラムに保存する

`articles.content_hash` は独立したカラム（TEXT 型）に保存する。
**metadata JSON 内に埋め込むことは禁止。**

**理由**: JSON 内フィールドにはインデックスが張れず、dedup Layer 3 の検索が O(n) になる。
専用カラム + `CREATE INDEX` で O(log n) を保証する。

```sql
-- OK: 専用カラム + インデックス
ALTER TABLE articles ADD COLUMN content_hash TEXT;
CREATE INDEX idx_articles_content_hash ON articles(content_hash);

-- NG: metadata JSON に埋め込む
-- { "content_hash": "abc123", "other": "..." }  ← 禁止
```

---

## Dedup は Phase 1（収集時）に実行する

重複排除（`dedup_service.rs`）は記事収集時（Phase 1）に実行する。
**Phase 4 への先送りは禁止。**

**理由**: dedup なしで DB に書き込むと、Phase 2 の AI 要約が重複記事でトークンを浪費する。

```
Phase 1: 収集 → dedup → DB 保存   ← ここで dedup
Phase 2: AI 要約（dedup 済みのみ処理）
Phase 3: スコアリング
Phase 4: フィード配信
```

`importance_score` の計算（`scoring_service.rs`）は Phase 2 以降で実装する。
Phase 1 ではデフォルト値 `0.0` のままで良い。
