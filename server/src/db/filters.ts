import type { DatabaseSync } from 'node:sqlite';
import type { KeywordFilterDto } from '../types/dto.ts';
import { all, get, run } from './query.ts';

interface FilterRow {
  id: number;
  keyword: string;
  filter_type: string;
  category: string | null;
  created_at: string;
}

const SELECT = 'SELECT id, keyword, filter_type, category, created_at FROM keyword_filters';

function toDto(r: FilterRow): KeywordFilterDto {
  return {
    id: r.id,
    keyword: r.keyword,
    filterType: r.filter_type,
    category: r.category,
    createdAt: r.created_at,
  };
}

export function getKeywordFilters(db: DatabaseSync): KeywordFilterDto[] {
  return all<FilterRow>(db, `${SELECT} ORDER BY created_at DESC`).map(toDto);
}

export function addKeywordFilter(
  db: DatabaseSync,
  keyword: string,
  filterType: string,
  category: string | null,
): KeywordFilterDto {
  const res = run(
    db,
    'INSERT INTO keyword_filters (keyword, filter_type, category) VALUES (?, ?, ?)',
    keyword,
    filterType,
    category,
  );
  const row = get<FilterRow>(db, `${SELECT} WHERE id = ?`, Number(res.lastInsertRowid));
  if (row === undefined) throw new Error('filter insert failed');
  return toDto(row);
}

export function removeKeywordFilter(db: DatabaseSync, id: number): void {
  run(db, 'DELETE FROM keyword_filters WHERE id = ?', id);
}
