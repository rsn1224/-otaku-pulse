/**
 * @module api
 * @description Tauri invoke の置換。ローカル Node サーバへの HTTP POST。
 * エラーは Rust AppError と同形 `{ kind, message }` を throw する（既存のエラー処理互換）。
 */

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/${command}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args ?? {}),
  });

  if (!res.ok) {
    let err: { kind: string; message: string };
    try {
      err = (await res.json()) as { kind: string; message: string };
    } catch {
      err = { kind: 'http', message: `HTTP ${res.status}` };
    }
    throw err;
  }

  const text = await res.text();
  return (text.length > 0 ? JSON.parse(text) : undefined) as T;
}
