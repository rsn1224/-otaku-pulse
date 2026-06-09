-- Phase 1: Foundation Correctness Migration
-- Combines: summary_hash for DeepDive cache, NFKC content_hash recalculation, is_duplicate reset

-- 1. Add summary_hash column to deepdive_cache for cache invalidation (BUG-02)
ALTER TABLE deepdive_cache ADD COLUMN summary_hash TEXT;

-- 2. Reset is_duplicate flag on all articles for NFKC re-dedup (D-05)
UPDATE articles SET is_duplicate = 0;

-- 3. Clear existing content_hash values so they are recalculated with NFKC on next collection (D-05)
-- NOTE: SQLite cannot run Rust NFKC in SQL. We clear hashes and let the next collect cycle
-- regenerate them with the new NFKC normalization. This is safe because is_duplicate is already reset.
UPDATE articles SET content_hash = NULL;
