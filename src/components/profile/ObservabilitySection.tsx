import { useTauriQuery } from '../../hooks/useTauriQuery';
import type { ObservabilityDto } from '../../lib/tauri-commands';

const fmtNum = (n: number): string => n.toLocaleString('en-US');
const fmtCost = (n: number): string => `$${n.toFixed(4)}`;
const fmtPct = (n: number): string => `${(n * 100).toFixed(1)}%`;

interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-(--outline)">{label}</span>
      <span className="text-lg font-semibold text-(--on-surface)">{value}</span>
    </div>
  );
}

export function ObservabilitySection(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useTauriQuery<ObservabilityDto>('get_observability');

  return (
    <>
      <div className="discover-card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-(--on-surface)">LLM 利用状況</span>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="card-action-btn secondary text-xs disabled:pointer-events-none disabled:opacity-40"
          >
            {isLoading ? '更新中…' : '更新'}
          </button>
        </div>

        {error !== null && <p className="text-xs text-(--error)">{error}</p>}

        {data !== null && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="呼出数" value={fmtNum(data.llm.totals.calls)} />
              <Stat
                label="トークン"
                value={fmtNum(data.llm.totals.promptTokens + data.llm.totals.completionTokens)}
              />
              <Stat label="推定コスト" value={fmtCost(data.llm.totals.costUsd)} />
              <Stat label="平均レイテンシ" value={`${fmtNum(data.llm.totals.avgLatencyMs)}ms`} />
            </div>

            {data.llm.totals.calls === 0 && (
              <p className="text-xs mt-3 text-(--outline)">
                まだ LLM 呼出がありません。要約・ダイジェスト・深堀りを実行すると記録されます。
              </p>
            )}
          </>
        )}
      </div>

      {data !== null && data.llm.byModel.length > 0 && (
        <div className="discover-card mt-4">
          <span className="block text-sm font-medium mb-3 text-(--on-surface)">モデル別</span>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-(--outline)">
              <span className="col-span-5">モデル</span>
              <span className="col-span-2 text-right">呼出</span>
              <span className="col-span-3 text-right">コスト</span>
              <span className="col-span-2 text-right">遅延</span>
            </div>
            {data.llm.byModel.map((m) => (
              <div
                key={`${m.provider}/${m.model}`}
                className="grid grid-cols-12 gap-2 text-xs items-center"
              >
                <span className="col-span-5 truncate text-(--on-surface)" title={m.model}>
                  {m.model}
                </span>
                <span className="col-span-2 text-right text-(--on-surface-variant)">
                  {fmtNum(m.calls)}
                </span>
                <span className="col-span-3 text-right text-(--primary)">{fmtCost(m.costUsd)}</span>
                <span className="col-span-2 text-right text-(--on-surface-variant)">
                  {fmtNum(m.avgLatencyMs)}ms
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data !== null && data.llm.byTask.length > 0 && (
        <div className="discover-card mt-4">
          <span className="block text-sm font-medium mb-3 text-(--on-surface)">タスク別</span>
          <div className="flex flex-wrap gap-2">
            {data.llm.byTask.map((t) => (
              <span
                key={t.task}
                className="px-2 py-1 rounded text-xs bg-(--surface-container) text-(--on-surface-variant)"
              >
                {t.task} · {fmtNum(t.calls)}
              </span>
            ))}
          </div>
        </div>
      )}

      {data !== null && (
        <div className="discover-card mt-4">
          <span className="block text-sm font-medium mb-3 text-(--on-surface)">
            収集パイプライン
          </span>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="記事総数" value={fmtNum(data.collection.totalArticles)} />
            <Stat label="重複" value={fmtNum(data.collection.duplicates)} />
            <Stat label="重複率" value={fmtPct(data.collection.dedupRate)} />
          </div>
          {data.collection.byCategory.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {data.collection.byCategory.map((c) => (
                <span
                  key={c.category}
                  className="px-2 py-1 rounded text-xs bg-(--surface-container) text-(--on-surface-variant)"
                >
                  {c.category} · {fmtNum(c.count)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
