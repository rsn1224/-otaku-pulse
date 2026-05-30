/**
 * Tauri invoke が reject する `AppError` は `{ kind, message }` のプレーンオブジェクトで、
 * Error インスタンスではない（`.claude/rules/tauri-v2-gotchas.md`）。そのため
 * `String(e)` は `[object Object]` になり、`e instanceof Error` も常に false になる。
 * 表示・ログ用の文字列はこのヘルパーで抽出する。
 */

/** Rust 側 `AppError` のシリアライズ形式（`{ kind, message }`）。 */
export interface SerializedAppError {
  kind: string;
  message: string;
}

function hasStringMessage(e: unknown): e is { message: string } {
  return typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string';
}

/** `{ kind, message }` 形式の AppError かどうかを判定する型ガード。 */
export function isSerializedAppError(e: unknown): e is SerializedAppError {
  return hasStringMessage(e) && 'kind' in e && typeof e.kind === 'string';
}

/**
 * 任意のスロー値から安全な表示文字列を取り出す。
 * AppError(`{ kind, message }`) / Error インスタンス / 文字列 を順に判定し、
 * いずれにも該当しなければ汎用メッセージを返す。
 */
export function extractErrorMessage(e: unknown): string {
  if (hasStringMessage(e)) return e.message;
  if (typeof e === 'string') return e;
  return '不明なエラーが発生しました';
}
