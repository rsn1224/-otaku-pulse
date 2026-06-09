import type { DatabaseSync } from 'node:sqlite';
import { loadSettings, upsertSetting } from '../db/settings.ts';
import { emitEvent } from '../events/bus.ts';
import { refreshAll } from '../services/collector.ts';

// scheduler.rs の collect ループ + 設定永続化/ホットリロード移植。
// digest / sync ループは Phase B で追加する。

export interface SchedulerConfig {
  collectIntervalMinutes: number;
  digestHour: number;
  digestMinute: number;
  enabled: boolean;
}

const DEFAULT: SchedulerConfig = {
  collectIntervalMinutes: 30,
  digestHour: 8,
  digestMinute: 0,
  enabled: true,
};

let cfg: SchedulerConfig = { ...DEFAULT };
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let stopped = false;
let database: DatabaseSync | null = null;

function scheduleNext(): void {
  if (stopped || !cfg.enabled || database === null) return;
  timer = setTimeout(() => void tick(), cfg.collectIntervalMinutes * 60_000);
}

async function tick(): Promise<void> {
  if (stopped || running || database === null) return;
  running = true;
  try {
    const r = await refreshAll(database, true); // due_only
    if (r.saved > 0) {
      console.log(`[scheduler] collected ${r.saved} articles`);
      emitEvent('collect-completed', r);
    }
  } catch (e) {
    console.error('[scheduler] collect failed', e);
  } finally {
    running = false;
    scheduleNext();
  }
}

export function loadSchedulerConfig(db: DatabaseSync): SchedulerConfig {
  const raw = loadSettings(db).scheduler_config;
  if (raw !== undefined) {
    try {
      return { ...DEFAULT, ...(JSON.parse(raw) as Partial<SchedulerConfig>) };
    } catch {
      // fall through to default
    }
  }
  return { ...DEFAULT };
}

export function getSchedulerConfig(): SchedulerConfig {
  return { ...cfg };
}

export function startScheduler(db: DatabaseSync): void {
  database = db;
  cfg = loadSchedulerConfig(db);
  stopped = false;
  if (cfg.enabled) {
    console.log(`[scheduler] collect loop every ${cfg.collectIntervalMinutes}min`);
    scheduleNext();
  } else {
    console.log('[scheduler] disabled');
  }
}

/** 設定を更新し永続化、稼働中ループへ即時反映する。 */
export function reconfigureScheduler(db: DatabaseSync, next: SchedulerConfig): void {
  cfg = next;
  upsertSetting(db, 'scheduler_config', JSON.stringify(next));
  if (timer !== undefined) clearTimeout(timer);
  scheduleNext();
}

export function stopScheduler(): void {
  stopped = true;
  if (timer !== undefined) clearTimeout(timer);
}
