---
phase: 01-foundation-correctness
verified: 2026-03-28T02:30:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 01: Foundation Correctness Verification Report

**Phase Goal:** The app starts reliably, dedup produces correct results for Japanese titles and URL variants, the DB supports concurrent reads, and the CI builds without a live database.
**Verified:** 2026-03-28T02:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Fatal startup error shows OS native dialog with Japanese message | VERIFIED | `rfd::MessageDialog` at lib.rs:120-124 with "OtakuPulse 起動エラー" |
| 2 | setup() converts all unwrap_or_else/panic calls to structured error returns | VERIFIED | run_setup() uses map_err+? throughout; panic at line 201 is in tauri runner (not setup) |
| 3 | Lock poisoning on LLM settings RwLock returns structured error instead of panicking | VERIFIED | lib.rs:58-62 uses map_err instead of expect() |
| 4 | DeepDive cache deserialization failures are warn-logged with defaults | VERIFIED | deepdive_service.rs:75-77 — tracing::warn! with Default::default() |
| 5 | personal_scoring JSON deserialization failures are warn-logged with defaults | VERIFIED | personal_scoring.rs:149-158 — tracing::warn! on all 3 fields |
| 6 | rate_limiter uses f64 token accounting to prevent fractional token loss | VERIFIED | rate_limiter.rs:11 Mutex<f64>, line 48 no `as u32`, line 96 `>= 1.0` |
| 7 | SQLite WAL mode enabled before migrations run | VERIFIED | database.rs:17-24 — PRAGMA WAL before sqlx::migrate! |
| 8 | NFKC normalization for Japanese title dedup | VERIFIED | dedup_service.rs:88 `.nfkc()`, line 131 `.nfkc()` in generate_content_hash |
| 9 | URL dedup normalizes by key-sorted params | VERIFIED | dedup_service.rs:52 `sort_by_key(|(k, _)| *k)` |
| 10 | DeepDive cache validates summary_hash and invalidates on summary change | VERIFIED | deepdive_service.rs:52-97 — summary_hash check + DELETE on mismatch |
| 11 | DeepDive cache TTL is 24 hours | VERIFIED | deepdive_service.rs:229 `CACHE_TTL_DAYS: i64 = 1` |
| 12 | Mute filtering executes in Rust SQL query, not TypeScript | VERIFIED | discover_queries.rs:51-53,85-87,122-124,172-174,201-203 — NOT EXISTS subquery in all 5 functions |
| 13 | CI can build with SQLX_OFFLINE=true without live database | VERIFIED | `SQLX_OFFLINE=true cargo check` exits 0; .sqlx/ dir exists (empty, correct for runtime queries) |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src-tauri/src/lib.rs | Staged startup error handling, OS native dialog, lock poisoning fix | VERIFIED | run_setup() pattern with rfd dialog on Err |
| src-tauri/src/infra/database.rs | WAL mode PRAGMA before migrations | VERIFIED | Lines 17-24 confirm ordering |
| src-tauri/src/infra/rate_limiter.rs | f64 token accounting | VERIFIED | Mutex<f64>, >= 1.0 check, no as u32 cast |
| src-tauri/src/services/deepdive_service.rs | warn-logged deserialization + summary_hash + TTL=1 | VERIFIED | All three present |
| src-tauri/src/services/personal_scoring.rs | warn-logged deserialization | VERIFIED | tracing::warn! on all 3 deserialization sites |
| src-tauri/src/services/dedup_service.rs | NFKC in normalize_title and generate_content_hash, key-sort in normalize_url | VERIFIED | Lines 88, 131, 52 |
| src-tauri/migrations/008_phase1_foundation.sql | summary_hash column, is_duplicate reset, content_hash clear | VERIFIED | All 3 SQL statements present |
| src-tauri/Cargo.toml | Pinned versions ~2.1, ~0.12, ~0.8 | VERIFIED | Lines 25-29 confirmed |
| src-tauri/.sqlx/ | Offline metadata directory | VERIFIED | Exists with .gitkeep; empty correct for runtime queries |
| src/lib/articleFilter.ts | applyMuteFilters removed, getHighlightKeywords retained | VERIFIED | Only getHighlightKeywords function present |
| src/stores/useDiscoverStore.ts | No applyMuteFilters calls | VERIFIED | grep returns empty |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| lib.rs setup() | database.rs init_pool() | Err propagation → rfd dialog | VERIFIED | map_err chain at lines 33-41 |
| lib.rs setup() | rfd::MessageDialog | Fatal error path before Err return | VERIFIED | Lines 119-126 |
| dedup_service.rs normalize_title() | dedup_service.rs generate_content_hash() | NFKC applied at both call sites | VERIFIED | Both apply .nfkc() independently |
| deepdive_service.rs | migrations/008_phase1_foundation.sql | summary_hash column read in cache lookup | VERIFIED | Schema added in 008, used in deepdive_service |
| useDiscoverStore.ts | articleFilter.ts | applyMuteFilters call sites removed | VERIFIED | No import or call found in any src/ file |
| discover_queries.rs | keyword_filters table | NOT EXISTS subquery in all 5 fetch functions | VERIFIED | 5 occurrences confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| deepdive_service.rs | summary_hash | SHA-256 of article.summary from DB | Yes — live query per lookup | FLOWING |
| dedup_service.rs | normalized content | .nfkc() transform of input | Yes — deterministic transform | FLOWING |
| discover_queries.rs | muted keyword filter | keyword_filters table via NOT EXISTS | Yes — DB-backed filter | FLOWING |
| rate_limiter.rs | tokens: f64 | Continuous f64 arithmetic | Yes — no truncation | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rust compiles without errors | `cargo check` in src-tauri | Finished dev profile in 0.44s | PASS |
| SQLX_OFFLINE build works | `SQLX_OFFLINE=true cargo check` in src-tauri | Finished dev profile in 0.39s | PASS |
| TypeScript type checks clean | `npx tsc --noEmit` | No output (exit 0) | PASS |
| Biome lint clean on modified frontend | `npx biome check articleFilter.ts useDiscoverStore.ts` | Checked 2 files, no fixes | PASS |
| applyMuteFilters fully removed | `grep -rn applyMuteFilters src/` | No output | PASS |
| WAL PRAGMA before migrations | grep ordering in database.rs | Lines 17, 20, 24 confirm correct order | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SAFE-01 | Plan 01 | setup() panics replaced with structured error + OS dialog | SATISFIED | run_setup() + rfd dialog pattern |
| SAFE-02 | Plan 01 | Lock poisoning returns AppError::Internal, no expect() in setup | SATISFIED | lib.rs:58-62 map_err |
| SAFE-03 | Plan 01 | DeepDive unwrap_or_default replaced with warn-logged fallback | SATISFIED | deepdive_service.rs:75-77 |
| SAFE-04 | Plan 01 | personal_scoring JSON deserialization with warn logging (D-12 override: warn+continue, not InvalidInput) | SATISFIED | personal_scoring.rs:149-158 |
| BUG-01 | Plan 02 | URL query params sorted by key name for order-independent dedup | SATISFIED | dedup_service.rs:52 sort_by_key |
| BUG-02 | Plan 02 | DeepDive cache validates summary_hash, 24h TTL | SATISFIED | deepdive_service.rs summary_hash + CACHE_TTL_DAYS=1 |
| BUG-03 | Plan 02 | NFKC normalization for half-width katakana dedup | SATISFIED | dedup_service.rs .nfkc() at lines 88, 131 |
| BUG-04 | Plan 01 | rate_limiter tokens: u32 → f64, no fractional loss | SATISFIED | rate_limiter.rs Mutex<f64>, >= 1.0 |
| PERF-01 | Plan 01 | SQLite WAL mode enabled before migrations | SATISFIED | database.rs:17-24 |
| DEP-01 | Plan 03 | feed-rs version pinned with ~ prefix | SATISFIED | Cargo.toml: feed-rs = "~2.1" |
| DEP-02 | Plan 03 | reqwest version pinned with ~ prefix | SATISFIED | Cargo.toml: version = "~0.12" |
| DEP-03 | Plan 03 | sqlx offline metadata, CI builds without live DB | SATISFIED | .sqlx/ exists; SQLX_OFFLINE=true cargo check passes |
| FRNT-01 | Plan 03 | applyMuteFilters moved to SQL, removed from TypeScript | SATISFIED | discover_queries.rs NOT EXISTS; articleFilter.ts function removed |

**All 13 requirement IDs accounted for. No orphaned requirements.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src-tauri/src/lib.rs | 201 | `panic!` in `unwrap_or_else` | Info | This panic is in the Tauri framework runner (`tauri::Builder::run()`), outside setup(). It fires only if the Tauri event loop itself fails to start — not a user-code startup panic. It is not in scope for SAFE-01 (which targeted setup()). No action required. |

No blocker anti-patterns found. The `panic!` at line 201 is structurally distinct from the setup() panics addressed by SAFE-01 — it is in `run()` after setup has already succeeded, within `unwrap_or_else` on the Tauri framework's own event loop bootstrap. This is a framework-level boundary.

---

### Human Verification Required

1. **OS Native Dialog Appears on Startup Failure**
   **Test:** Temporarily corrupt the DB path or make app_data_dir unavailable, then launch the app.
   **Expected:** An OS-native error dialog appears with title "致命的なエラー" and body containing "OtakuPulse 起動エラー" before the app exits.
   **Why human:** Requires triggering a real startup failure condition with a running Tauri process.

2. **NFKC Dedup Produces Correct Results with Real Articles**
   **Test:** Ingest articles with half-width katakana titles (e.g., ｶﾞﾝﾀﾞﾑ) alongside full-width equivalents (ガンダム), observe is_duplicate flags.
   **Expected:** Both articles are flagged as duplicates of each other.
   **Why human:** Requires a live database with actual article ingestion.

3. **Mute Filter Works End-to-End**
   **Test:** Add a mute keyword in Settings, then open the Discover feed.
   **Expected:** Articles matching the muted keyword are absent from the feed list.
   **Why human:** Requires a running app with keyword_filters populated.

---

### Gaps Summary

No gaps. All 13 must-haves are verified. All 13 requirement IDs (SAFE-01 through SAFE-04, BUG-01 through BUG-04, PERF-01, DEP-01 through DEP-03, FRNT-01) are satisfied by concrete, wired, data-flowing implementations.

Notable observation on SAFE-04: The requirement text specified "AppError::InvalidInput on corruption" but the locked decision D-12 chose warn+continue behavior instead. All three plans explicitly document this override. The implementation satisfies the user's intent (no silent failures) even though it differs from the requirement wording. This is a known, documented deviation, not a gap.

Notable observation on .sqlx/: The directory contains only `.gitkeep` (no JSON query files). This is correct behavior because the project uses `sqlx::query()` runtime queries rather than `sqlx::query!()` compile-time macros. `SQLX_OFFLINE=true cargo check` passes, confirming DEP-03 is satisfied.

---

_Verified: 2026-03-28T02:30:00Z_
_Verifier: Claude (gsd-verifier)_
