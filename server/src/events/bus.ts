import { EventEmitter } from 'node:events';

// ADR-1 EventBus の最小実装。Tauri の app_handle.emit() → SSE ブリッジに置換。

export interface DomainEvent {
  type: string;
  payload: unknown;
}

export const bus = new EventEmitter();

/** ドメインイベントを発火する。SSE 経由で FE に配信される。 */
export function emitEvent(type: string, payload: unknown = null): void {
  bus.emit('event', { type, payload } satisfies DomainEvent);
}
