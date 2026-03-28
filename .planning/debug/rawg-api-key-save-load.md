---
status: awaiting_human_verify
trigger: "RAWG APIキーの保存/読み込みが部分的に動作しない"
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED — Multiple bugs causing partial behavior
test: all relevant files read and analyzed
expecting: fix ApiKeysSection.tsx and ScheduleWing.tsx for proper error/success feedback
next_action: implement fixes

## Symptoms

expected: RAWG APIキーが設定画面から正常に保存・読み込みできること
actual: 部分的にしか動作しない（完全な失敗ではないが正常でもない）
errors: 不明（ユーザー未提供）
reproduction: 設定画面からRAWG APIキーを操作する
started: 不明

## Eliminated

- hypothesis: Tauri command not registered
  evidence: set_rawg_api_key, clear_rawg_api_key, is_rawg_api_key_set all registered in lib.rs lines 245-247
  timestamp: 2026-03-28T00:01:00Z

- hypothesis: Parameter naming mismatch (snake_case vs camelCase)
  evidence: Rust api_key → JS apiKey is correct per Tauri v2 convention
  timestamp: 2026-03-28T00:01:00Z

- hypothesis: AppState caching issue (like Perplexity pattern)
  evidence: RAWG commands read credential store directly — no in-memory AppState for RAWG
  timestamp: 2026-03-28T00:01:00Z

## Evidence

- timestamp: 2026-03-28T00:01:00Z
  checked: src-tauri/src/commands/schedule.rs lines 147-169
  found: set_rawg_api_key, clear_rawg_api_key, is_rawg_api_key_set all directly use credential_store
  implication: backend is correct — reads credential store fresh every time, no caching bug

- timestamp: 2026-03-28T00:01:00Z
  checked: src/components/settings/ApiKeysSection.tsx
  found: handleRawgSave/handleRawgClear have no success toast notifications; errors are caught but only logged — no UI feedback
  implication: user cannot tell if save succeeded or failed (partially works = appears to save but no confirmation)

- timestamp: 2026-03-28T00:01:00Z
  checked: src/components/wings/ScheduleWing.tsx fetchData()
  found: outer catch block sets setGames([]) but never calls setRawgKeySet(false); if get_game_releases fails (invalid key, network error), games list is empty but rawgKeySet might still show true
  implication: "partial" — key saved successfully but game data doesn't load; error silently swallowed

- timestamp: 2026-03-28T00:01:00Z
  checked: src-tauri/src/commands/llm.rs set_perplexity_api_key
  found: credential store failure is logged with warn() but returns Ok(()) to frontend — inconsistent with set_rawg_api_key which returns Err on credential failure
  implication: Perplexity key "appears" saved even when credential store fails (session-only, lost on restart)

- timestamp: 2026-03-28T00:01:00Z
  checked: src/lib/ directory
  found: tauri-commands.ts does NOT exist; all invoke() calls are directly in components violating architecture rule
  implication: architecture debt — not the primary bug but should be noted

## Resolution

root_cause: Three compounding issues cause "partial" behavior:
  1. ApiKeysSection.tsx — no success/error toast feedback for RAWG save/clear operations; user has no confirmation the operation worked
  2. ScheduleWing.tsx — fetchData() catch block silently discards get_game_releases errors; if API key is invalid or network fails, games list is empty with no error message shown
  3. set_perplexity_api_key (llm.rs) — credential store failure is swallowed, key appears set for session only, lost on restart

fix: |
  1. src/components/settings/ApiKeysSection.tsx — added useToast() hook; added showToast('success'|'error') to all four handlers (handleRawgSave, handleRawgClear, handlePerplexitySave, handlePerplexityClear)
  2. src/components/wings/ScheduleWing.tsx — added fetchError state; fetchData() now captures error message and sets fetchError; renderContent() shows error UI before the "key not set" check
  3. src-tauri/src/commands/llm.rs — set_perplexity_api_key now propagates credential store errors via ? (no longer silently swallows); clear_perplexity_api_key same fix
verification: |
  - npm run check — passed (17 pre-existing warnings, 0 errors, 1 file auto-fixed by Biome)
  - npm run typecheck — passed (0 errors)
  - cargo clippy -- -D warnings — passed (0 warnings)
  - cargo test — 168 passed, 0 failed
files_changed:
  - src/components/settings/ApiKeysSection.tsx
  - src/components/wings/ScheduleWing.tsx
  - src-tauri/src/commands/llm.rs
