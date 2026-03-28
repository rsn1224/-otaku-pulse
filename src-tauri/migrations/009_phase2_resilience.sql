-- SEC-02: User profile field size limits
-- SQLite does not support ALTER TABLE ADD CHECK, so we use BEFORE triggers
-- Size limits rationale:
--   favorite_titles:   JSON array, max ~50 entries x ~100 chars each = ~6000 bytes
--   favorite_genres:   JSON array, max ~20 entries x ~50 chars each  = ~1000 bytes
--   favorite_creators: JSON array, max ~50 entries x ~100 chars each = ~6000 bytes

-- Trigger for UPDATE operations
CREATE TRIGGER IF NOT EXISTS check_profile_size_update
BEFORE UPDATE ON user_profile
BEGIN
    SELECT CASE
        WHEN length(NEW.favorite_titles) > 6000
            THEN RAISE(ABORT, 'favorite_titles exceeds 6000 byte limit')
        WHEN length(NEW.favorite_genres) > 1000
            THEN RAISE(ABORT, 'favorite_genres exceeds 1000 byte limit')
        WHEN length(NEW.favorite_creators) > 6000
            THEN RAISE(ABORT, 'favorite_creators exceeds 6000 byte limit')
    END;
END;

-- Trigger for INSERT operations
CREATE TRIGGER IF NOT EXISTS check_profile_size_insert
BEFORE INSERT ON user_profile
BEGIN
    SELECT CASE
        WHEN length(NEW.favorite_titles) > 6000
            THEN RAISE(ABORT, 'favorite_titles exceeds 6000 byte limit')
        WHEN length(NEW.favorite_genres) > 1000
            THEN RAISE(ABORT, 'favorite_genres exceeds 1000 byte limit')
        WHEN length(NEW.favorite_creators) > 6000
            THEN RAISE(ABORT, 'favorite_creators exceeds 6000 byte limit')
    END;
END;
