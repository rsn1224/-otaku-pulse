import type { DatabaseSync, StatementResultingChanges } from 'node:sqlite';

/** node:sqlite のバインド可能な値。 */
export type BindValue = null | number | bigint | string | Uint8Array;

/** 行配列を型付きで取得する。`SELECT ... ` 用。 */
export function all<T>(db: DatabaseSync, sql: string, ...params: BindValue[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

/** 単一行を型付きで取得する。見つからなければ undefined。 */
export function get<T>(db: DatabaseSync, sql: string, ...params: BindValue[]): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}

/** INSERT/UPDATE/DELETE を実行し、変更件数等を返す。 */
export function run(
  db: DatabaseSync,
  sql: string,
  ...params: BindValue[]
): StatementResultingChanges {
  return db.prepare(sql).run(...params);
}
