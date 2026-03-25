import type React from 'react';

const COLLECT_INTERVALS = [
  { label: '30分', value: 30 },
  { label: '1時間', value: 60 },
  { label: '3時間', value: 180 },
  { label: '6時間', value: 360 },
];

export const SchedulerToggle: React.FC<{
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}> = ({ enabled, onToggle }) => (
  <div className="mb-6">
    <div className="text-sm font-medium text-gray-300 mb-3">自動スケジュール</div>
    <div className="flex items-center space-x-4">
      <label className="flex items-center cursor-pointer">
        <input
          type="radio"
          name="scheduler-enabled"
          checked={enabled}
          onChange={() => onToggle(true)}
          className="sr-only"
        />
        <div
          className={`w-12 h-6 rounded-full transition-colors ${
            enabled ? 'bg-blue-500' : 'bg-gray-600'
          }`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full transition-transform transform ${
              enabled ? 'translate-x-6' : 'translate-x-0.5'
            } mt-0.5`}
          />
        </div>
        <span className={`ml-3 ${enabled ? 'text-blue-400' : 'text-gray-400'}`}>ON</span>
      </label>

      <label className="flex items-center cursor-pointer">
        <input
          type="radio"
          name="scheduler-enabled"
          checked={!enabled}
          onChange={() => onToggle(false)}
          className="sr-only"
        />
        <div
          className={`w-12 h-6 rounded-full transition-colors ${
            !enabled ? 'bg-gray-600' : 'bg-gray-600'
          }`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full transition-transform transform ${
              !enabled ? 'translate-x-6' : 'translate-x-0.5'
            } mt-0.5`}
          />
        </div>
        <span className={`ml-3 ${!enabled ? 'text-gray-400' : 'text-gray-500'}`}>OFF</span>
      </label>
    </div>
  </div>
);

export const CollectInterval: React.FC<{
  interval: number;
  enabled: boolean;
  onChange: (interval: number) => void;
}> = ({ interval, enabled, onChange }) => (
  <div className="mb-6">
    <div className="text-sm font-medium text-gray-300 mb-3">フィード収集間隔</div>
    <div className="flex space-x-3">
      {COLLECT_INTERVALS.map((intervalOption) => (
        <label key={intervalOption.value} className="flex items-center cursor-pointer">
          <input
            type="radio"
            name="collect-interval"
            value={intervalOption.value}
            checked={interval === intervalOption.value}
            onChange={() => onChange(intervalOption.value)}
            disabled={!enabled}
            className="sr-only"
          />
          <div
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              interval === intervalOption.value
                ? 'border-blue-500 bg-blue-500'
                : 'border-gray-500 bg-gray-700'
            }`}
          >
            {interval === intervalOption.value && (
              <div className="w-2 h-2 bg-white rounded-full m-0.5" />
            )}
          </div>
          <span
            className={`ml-2 ${
              interval === intervalOption.value ? 'text-blue-400' : 'text-gray-400'
            } ${!enabled ? 'opacity-50' : ''}`}
          >
            {intervalOption.label}
          </span>
        </label>
      ))}
    </div>
  </div>
);

export const DigestTime: React.FC<{
  hour: number;
  minute: number;
  enabled: boolean;
  onChange: (hour: number, minute: number) => void;
}> = ({ hour, minute, enabled, onChange }) => (
  <div className="mb-6">
    <div className="text-sm font-medium text-gray-300 mb-3">ダイジェスト生成時刻</div>
    <div className="flex items-center space-x-2">
      <span className="text-gray-400">毎日</span>
      <input
        type="number"
        min="0"
        max="23"
        value={hour}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 8, minute)}
        disabled={!enabled}
        className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-center text-gray-100 disabled:opacity-50"
      />
      <span className="text-gray-400">:</span>
      <input
        type="number"
        min="0"
        max="59"
        value={minute}
        onChange={(e) => onChange(hour, parseInt(e.target.value, 10) || 0)}
        disabled={!enabled}
        className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-center text-gray-100 disabled:opacity-50"
      />
    </div>
  </div>
);

export const SchedulerStatus: React.FC<{
  lastCollectedAt: string | null;
  lastCollectResult: { fetched: number; saved: number } | null;
  collectError: string | null;
  getNextCollectTime: () => string;
  getNextDigestTime: () => string;
  formatTime: (dateStr: string | null) => string;
}> = ({
  lastCollectedAt,
  lastCollectResult,
  collectError,
  getNextCollectTime,
  getNextDigestTime,
  formatTime,
}) => (
  <div className="border-t border-gray-600 pt-4">
    <div className="text-sm font-medium text-gray-300 mb-3">
      ── ステータス ───────────────────────────
    </div>

    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-400">最終収集:</span>
        <span className="text-gray-200">
          {formatTime(lastCollectedAt)}
          {lastCollectResult && `（記事 ${lastCollectResult.saved}件保存）`}
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-gray-400">次回収集:</span>
        <span className="text-gray-200">{getNextCollectTime()}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-gray-400">次回ダイジェスト:</span>
        <span className="text-gray-200">{getNextDigestTime()}</span>
      </div>

      {collectError && <div className="text-red-400 text-xs mt-2">エラー: {collectError}</div>}
    </div>
  </div>
);
