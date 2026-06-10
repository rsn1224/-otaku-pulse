-- ADR-13 オブザーバビリティ: 全 LLM 呼出の provider/model/task/tokens/latency/cost を記録。
CREATE TABLE IF NOT EXISTS llm_metrics (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    provider          TEXT NOT NULL,
    model             TEXT NOT NULL,
    task              TEXT NOT NULL,
    prompt_tokens     INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms        INTEGER NOT NULL DEFAULT 0,
    cost_usd          REAL NOT NULL DEFAULT 0.0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_llm_metrics_created ON llm_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_metrics_model ON llm_metrics(model);
