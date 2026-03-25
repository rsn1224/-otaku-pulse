---
description: Dedup は Phase 1（収集時）に実行する
---

# Dedup は Phase 1（収集時）に実行する

重複排除（dedup_service.rs）は記事収集時に実行する。
Phase 4 への先送りは禁止。理由: dedup なしで DB に書き込むと
Phase 2 の AI 要約が重複記事でトークンを浪費する。

importance_score の計算（scoring_service.rs）は Phase 2 以降で実装する。
Phase 1 ではデフォルト値 0.0 のままで良い。
