/**
 * @module events
 * @description Tauri の `listen` 置換。単一の SSE 接続（`/events`）を共有し、
 * 名前付きイベントを購読する。`@tauri-apps/api/event` と互換のシグネチャ。
 */

let source: EventSource | null = null;

function ensureSource(): EventSource {
  if (source === null) {
    source = new EventSource('/events');
  }
  return source;
}

/** イベントを購読し、アンリスン関数を返す。handler は `{ payload }` を受け取る。 */
export async function listen<T>(
  type: string,
  handler: (event: { payload: T }) => void,
): Promise<() => void> {
  const es = ensureSource();
  const listener = (e: MessageEvent): void => {
    let payload: T;
    try {
      payload = (typeof e.data === 'string' && e.data.length > 0 ? JSON.parse(e.data) : null) as T;
    } catch {
      payload = e.data as T;
    }
    handler({ payload });
  };
  es.addEventListener(type, listener);
  return () => es.removeEventListener(type, listener);
}
