import type { DatabaseSync } from 'node:sqlite';
import { AppError, invalidInput } from '../error.ts';
import type { UserProfileDto } from '../types/dto.ts';
import { all, get, run } from './query.ts';

// profile_service.rs の移植。user_profile は id=1 の単一行。

interface ProfileRow {
  display_name: string;
  favorite_titles: string;
  favorite_genres: string;
  favorite_creators: string;
  total_read: number;
}

const MAX_TITLES = 6000;
const MAX_GENRES = 1000;
const MAX_CREATORS = 6000;

function parseJsonArray(s: string): string[] {
  try {
    const a = JSON.parse(s) as unknown;
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function getProfile(db: DatabaseSync): UserProfileDto {
  const row = get<ProfileRow>(
    db,
    'SELECT display_name, favorite_titles, favorite_genres, favorite_creators, total_read FROM user_profile WHERE id = 1',
  );
  if (row === undefined) throw new AppError('database', 'profile not found');
  return {
    displayName: row.display_name,
    favoriteTitles: parseJsonArray(row.favorite_titles),
    favoriteGenres: parseJsonArray(row.favorite_genres),
    favoriteCreators: parseJsonArray(row.favorite_creators),
    totalRead: row.total_read,
  };
}

export function updateProfile(db: DatabaseSync, dto: UserProfileDto): void {
  const titles = JSON.stringify(dto.favoriteTitles);
  const genres = JSON.stringify(dto.favoriteGenres);
  const creators = JSON.stringify(dto.favoriteCreators);
  if (titles.length > MAX_TITLES)
    throw invalidInput(`favorite_titles exceeds ${MAX_TITLES} byte limit`);
  if (genres.length > MAX_GENRES)
    throw invalidInput(`favorite_genres exceeds ${MAX_GENRES} byte limit`);
  if (creators.length > MAX_CREATORS) {
    throw invalidInput(`favorite_creators exceeds ${MAX_CREATORS} byte limit`);
  }
  run(
    db,
    "UPDATE user_profile SET display_name = ?, favorite_titles = ?, favorite_genres = ?, favorite_creators = ?, updated_at = datetime('now') WHERE id = 1",
    dto.displayName,
    titles,
    genres,
    creators,
  );
}

export function incrementReadCount(db: DatabaseSync): void {
  run(db, 'UPDATE user_profile SET total_read = total_read + 1 WHERE id = 1');
}

export function resetLearningData(db: DatabaseSync): void {
  run(db, 'DELETE FROM article_interactions');
  run(db, 'DELETE FROM article_scores');
  run(db, 'UPDATE user_profile SET total_read = 0 WHERE id = 1');
}

export function adjustFeedPreference(db: DatabaseSync, feedId: number, delta: number): void {
  run(
    db,
    `UPDATE article_scores SET
       personal_score = personal_score + ?,
       total_score = base_score * 0.3 + (personal_score + ?) * 0.4 + (total_score - base_score * 0.3 - personal_score * 0.4) * 1.0
     WHERE article_id IN (SELECT id FROM articles WHERE feed_id = ?)`,
    delta,
    delta,
    feedId,
  );
}

export function getInteractionStats(db: DatabaseSync): Array<{ category: string; cnt: number }> {
  return all<{ category: string; cnt: number }>(
    db,
    `SELECT f.category, COUNT(*) AS cnt
     FROM article_interactions ai
     JOIN articles a ON ai.article_id = a.id
     JOIN feeds f ON a.feed_id = f.id
     WHERE ai.action IN ('open', 'bookmark', 'deepdive')
     GROUP BY f.category ORDER BY cnt DESC`,
  );
}

export function getTopInteractionTitles(db: DatabaseSync, limit: number): string[] {
  return all<{ title: string }>(
    db,
    `SELECT a.title FROM article_interactions ai
     JOIN articles a ON ai.article_id = a.id
     WHERE ai.action IN ('bookmark', 'deepdive')
     ORDER BY ai.created_at DESC LIMIT ?`,
    limit,
  ).map((r) => r.title);
}
