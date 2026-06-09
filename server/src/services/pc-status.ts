import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AppError } from '../error.ts';

// dashboard_reader.rs + pc_status_service.rs の移植（機能A）。
// C:\Dashboard\config\frameworks.json と .last-apply.json マーカーを直読みする。

const DASHBOARD_CONFIG = 'C:\\Dashboard\\config\\frameworks.json';
const TS_KEYS = ['timestamp', 'appliedAt', 'applied_at', 'lastApply', 'date'];

export interface FrameworkStatusDto {
  name: string;
  kind: string;
  priority: string;
  note: string | null;
  applied: boolean;
  lastApply: string | null;
}

export interface PcStatusView {
  frameworks: FrameworkStatusDto[];
  pendingPlans: number;
  appliedCount: number;
  totalCount: number;
}

interface FwEntry {
  name: string;
  path: string;
  type: string;
  priority: string;
  note?: string | null;
}

interface FrameworksFile {
  plansDir?: string;
  frameworks: FwEntry[];
}

function readApplyMarker(markerPath: string): { applied: boolean; lastApply: string | null } {
  if (!existsSync(markerPath)) return { applied: false, lastApply: null };
  let ts: string | null = null;
  try {
    const v = JSON.parse(readFileSync(markerPath, 'utf8')) as Record<string, unknown>;
    for (const k of TS_KEYS) {
      if (typeof v[k] === 'string') {
        ts = v[k] as string;
        break;
      }
    }
  } catch {
    // ignore malformed marker
  }
  if (ts === null) {
    try {
      ts = statSync(markerPath).mtime.toISOString();
    } catch {
      ts = null;
    }
  }
  return { applied: true, lastApply: ts };
}

function countPendingPlans(dir: string): number {
  try {
    return readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md')).length;
  } catch {
    return 0;
  }
}

export function getPcStatus(): PcStatusView {
  let raw: string;
  try {
    raw = readFileSync(DASHBOARD_CONFIG, 'utf8');
  } catch (e) {
    throw new AppError(
      'internal',
      `dashboard config 読み込み失敗 (${DASHBOARD_CONFIG}): ${(e as Error).message}`,
    );
  }

  let parsed: FrameworksFile;
  try {
    parsed = JSON.parse(raw) as FrameworksFile;
  } catch (e) {
    throw new AppError('parse', `frameworks.json パース失敗: ${(e as Error).message}`);
  }

  const frameworks: FrameworkStatusDto[] = parsed.frameworks.map((fw) => {
    const { applied, lastApply } = readApplyMarker(join(fw.path, '.last-apply.json'));
    return {
      name: fw.name,
      kind: fw.type,
      priority: fw.priority,
      note: fw.note ?? null,
      applied,
      lastApply,
    };
  });

  const pendingPlans = parsed.plansDir !== undefined ? countPendingPlans(parsed.plansDir) : 0;
  const appliedCount = frameworks.filter((f) => f.applied).length;
  return { frameworks, pendingPlans, appliedCount, totalCount: frameworks.length };
}
