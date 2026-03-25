---
description: content_hash は専用カラムに保存する（metadata JSON 禁止）
---

# content_hash は専用カラムに保存する

articles.content_hash は独立したカラム（TEXT 型）に保存する。
metadata JSON 内に埋め込むことは禁止。

理由: JSON 内フィールドにはインデックスが張れず、
dedup Layer 3 の検索が O(n) になる。
専用カラム + CREATE INDEX で O(log n) を保証する。
