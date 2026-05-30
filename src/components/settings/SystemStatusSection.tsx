import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import { getPcStatus } from '../../lib/tauri-commands';
import type { PcStatusView } from '../../types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

/**
 * PC / システム状態パネル (機能A)。
 * 記事化を廃止し、get_pc_status から read-only で取得・表示する。
 * Dashboard 未検出の環境では取得失敗のメッセージにフォールバックする。
 */
export function SystemStatusSection(): React.JSX.Element {
  const [status, setStatus] = useState<PcStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await getPcStatus());
    } catch (e) {
      logger.error({ error: e }, 'getPcStatus failed');
      setError('PC 状態を取得できませんでした (Dashboard カタログ未検出)');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3 p-4 rounded-lg bg-(--surface-container)">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">PC / システム状態</span>
          <span className="text-xs text-(--on-surface-variant)">
            フレームワーク適用状況・pending plans
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          isLoading={loading}
          onClick={() => {
            void load();
          }}
        >
          再読み込み
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-(--on-surface-variant)">
          <Spinner size="sm" />
          読み込み中...
        </div>
      )}

      {!loading && error && <p className="text-xs text-(--on-surface-variant)">{error}</p>}

      {!loading && status && (
        <>
          <div className="flex gap-4 text-xs text-(--on-surface-variant)">
            <span>
              適用済み{' '}
              <span className="text-(--primary) font-semibold">
                {status.appliedCount}/{status.totalCount}
              </span>
            </span>
            <span>
              pending plans{' '}
              <span className="text-(--on-surface) font-semibold">{status.pendingPlans}</span>
            </span>
          </div>
          <ul className="space-y-1">
            {status.frameworks.map((fw) => (
              <li
                key={fw.name}
                className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-(--surface-container-high) border border-(--outline-variant)"
              >
                <span className="truncate text-(--on-surface)">
                  <span className="text-(--on-surface-variant)">[{fw.priority}]</span> {fw.name}
                  <span className="text-(--on-surface-variant)"> ({fw.kind})</span>
                </span>
                <span
                  className={
                    fw.applied
                      ? 'shrink-0 text-(--primary)'
                      : 'shrink-0 text-(--on-surface-variant)'
                  }
                >
                  {fw.applied ? '適用済み' : '未適用'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
