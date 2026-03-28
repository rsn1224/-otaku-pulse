# Retrospective

## Milestone: v1.0 -- Stabilization & Optimization

**Shipped:** 2026-03-28
**Phases:** 3 | **Plans:** 10 | **Tasks:** 17

### What Was Built

- Panic-free startup with OS native error dialog + SQLite WAL mode
- NFKC Unicode dedup + URL param normalization + DeepDive cache invalidation
- Dependency pinning (feed-rs, reqwest, sqlx) + sqlx offline mode + mute filter SQL migration
- CancellationToken graceful shutdown + watch-channel config hot-reload
- RSS error surfacing + LLM provider switch guard + event-driven offline mode
- API key log audit + OPML URL validation + profile size limits (defense-in-depth)
- Parallel digest (tokio::join!) + CTE query consolidation + FTS pagination + rayon URL normalization
- 120+ tests (Rust + TypeScript) + coverage infrastructure (cargo-llvm-cov + @vitest/coverage-v8)

### What Worked

- **Coarse granularity (3 phases):** Research suggested 6 phases, but compressing to 3 reduced planning overhead and maintained momentum
- **Phase-by-phase execution:** Foundation -> Resilience -> Performance ordering meant each phase built on stable ground
- **gsd-tools automation:** Plan/summary/state management via CLI kept artifacts consistent without manual bookkeeping
- **Defense-in-depth pattern:** App-layer + DB trigger validation for profile limits caught the design right the first time
- **Test-alongside-fix approach:** Writing tests in the same milestone as the fixes (not deferred) ensures coverage stays coupled to changes

### What Was Inefficient

- **ROADMAP.md Phase 2 tracking inconsistency:** Phase 2 showed "0/3 Planned" despite being complete -- tracking artifacts need better auto-update on phase completion
- **SUMMARY.md one-liner extraction:** gsd-tools summary-extract produced noisy output ("One-liner:" prefixes, rule references) -- required manual cleanup for MILESTONES.md
- **STATE.md velocity metrics:** Progress percent showed 0% despite 100% completion -- metric calculation needs review

### Patterns Established

- **watch::channel for config hot-reload:** Reactive push pattern over Arc<RwLock> polling -- applicable to future runtime config changes
- **CancellationToken as independent State:** Avoids circular Arc patterns in Tauri state management
- **Provider guard at command layer:** Keeps service layer pure, guards at the boundary
- **RAYON_THRESHOLD gating:** Prevents thread-pool overhead for small collections (threshold=50)
- **Arc<dyn Trait> for tokio::join!:** Required for sharing trait objects across parallel async tasks (Box doesn't work)

### Key Lessons

1. **AniList rate limit is 30 req/min, not 90:** Public docs are wrong; design around real observed limits
2. **sqlx offline mode works with empty .sqlx/ for runtime queries:** No compile-time macros needed
3. **Tauri invoke() errors are plain objects, not Error instances:** Frontend error handling must account for this
4. **mockResolvedValue over mockResolvedValueOnce for React hooks:** Multi-render patterns need persistent mocks
5. **ToastProvider wrapper needed in hook tests:** Hooks using useToast() internally require context in test setup

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 3 |
| Plans | 10 |
| Tasks | 17 |
| Commits | 36 |
| Files changed | 65 |
| Lines added | +9,151 |
| Lines removed | -498 |
| Tests added | 120+ |
| Requirements | 33/33 |
| Timeline | 1 day |
