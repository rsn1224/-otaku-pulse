# Milestones

## v1.0 Stabilization & Optimization (Shipped: 2026-03-28)

**Phases completed:** 3 phases, 10 plans, 17 tasks
**Timeline:** 2026-03-28 (1 day sprint, 36 commits)
**Changes:** 65 files, +9,151 / -498 lines
**Requirements:** 33/33 complete

**Key accomplishments:**

1. Panic-free startup with OS native error dialog, SQLite WAL mode, rate limiter f64 precision
2. NFKC Unicode normalization for Japanese dedup, URL param key-sort, DeepDive cache invalidation with summary-hash
3. Dependency version pinning (feed-rs, reqwest, sqlx), .sqlx/ offline mode, mute filtering migrated to SQL
4. CancellationToken graceful shutdown with 5s timeout, watch-channel config hot-reload
5. RSS feed error surfacing, DeepDive LLM provider switch guard, event-driven offline mode
6. API key log audit, OPML URL validation, user profile size limits with defense-in-depth DB triggers
7. Parallel digest generation (tokio::join!), CTE query consolidation, FTS pagination, rayon URL normalization
8. 120+ tests added: dedup (28), rate limiter (5), scheduler (3), scoring (7), TS hooks (9), components (12) + coverage infrastructure

**Archive:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

---
