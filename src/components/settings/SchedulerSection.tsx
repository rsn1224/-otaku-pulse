import type React from 'react';
import { useEffect, useState } from 'react';
import { useSchedulerStore } from '../../stores/useSchedulerStore';
import { useToast } from '../common/Toast';
import { CollectInterval, DigestTime, SchedulerStatus, SchedulerToggle } from './SchedulerControls';

interface SchedulerSectionProps {
  onSettingsChange?: () => void;
}

const formatTime = (dateStr: string | null) => {
  if (!dateStr) return 'なし';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins}分前`;
  } else if (diffHours < 24) {
    return `${diffHours}時間前`;
  } else {
    return date.toLocaleDateString('ja-JP');
  }
};

const getNextCollectTime = (lastCollectedAt: string | null, intervalMinutes: number) => {
  if (!lastCollectedAt) return 'なし';

  const lastCollect = new Date(lastCollectedAt);
  const nextCollect = new Date(lastCollect.getTime() + intervalMinutes * 60 * 1000);
  const now = new Date();

  if (nextCollect <= now) {
    return 'まもなく';
  }

  const diffMs = nextCollect.getTime() - now.getTime();
  const diffMins = Math.ceil(diffMs / (1000 * 60));

  if (diffMins < 60) {
    return `約${diffMins}分後`;
  } else {
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return `約${diffHours}時間${remainingMins > 0 ? `${remainingMins}分` : ''}後`;
  }
};

const getNextDigestTime = (hour: number, minute: number) => {
  const now = new Date();
  const nextDigest = new Date();
  nextDigest.setHours(hour, minute, 0, 0);

  if (nextDigest <= now) {
    nextDigest.setDate(nextDigest.getDate() + 1);
  }

  return `明日 ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

export const SchedulerSection: React.FC<SchedulerSectionProps> = ({ onSettingsChange }) => {
  const {
    config,
    lastCollectedAt,
    lastCollectResult,
    collectError,
    loadConfig,
    saveConfig,
    startListening,
    runDigestNow,
  } = useSchedulerStore();

  const { showToast } = useToast();
  const [localConfig, setLocalConfig] = useState(config);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const cleanup = async () => {
      const unlisten = await startListening();
      return unlisten;
    };

    const promise = cleanup();
    return () => {
      promise.then((unlisten) => unlisten()).catch(console.error);
    };
  }, [startListening]);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = async () => {
    try {
      await saveConfig(localConfig);
      showToast('success', '設定を保存しました');
      onSettingsChange?.();
    } catch (error) {
      console.error('Failed to save scheduler config:', error);
      showToast('error', '設定の保存に失敗しました');
    }
  };

  const handleRunDigestNow = async () => {
    setIsGenerating(true);
    try {
      await runDigestNow();
      showToast('success', 'ダイジェスト生成を開始しました');
    } catch (error) {
      console.error('Failed to run digest now:', error);
      showToast('error', 'ダイジェスト生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-100">⏰ 自動収集・ダイジェスト設定</h3>
      </div>

      <SchedulerToggle
        enabled={localConfig.enabled}
        onToggle={(enabled) => setLocalConfig({ ...localConfig, enabled })}
      />

      <CollectInterval
        interval={localConfig.collect_interval_minutes}
        enabled={localConfig.enabled}
        onChange={(interval) =>
          setLocalConfig({ ...localConfig, collect_interval_minutes: interval })
        }
      />

      <DigestTime
        hour={localConfig.digest_hour}
        minute={localConfig.digest_minute}
        enabled={localConfig.enabled}
        onChange={(hour, minute) =>
          setLocalConfig({ ...localConfig, digest_hour: hour, digest_minute: minute })
        }
      />

      <div className="mb-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={!localConfig.enabled}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          設定を保存
        </button>
      </div>

      <SchedulerStatus
        lastCollectedAt={lastCollectedAt}
        lastCollectResult={lastCollectResult}
        collectError={collectError}
        getNextCollectTime={() =>
          getNextCollectTime(lastCollectedAt, localConfig.collect_interval_minutes)
        }
        getNextDigestTime={() =>
          getNextDigestTime(localConfig.digest_hour, localConfig.digest_minute)
        }
        formatTime={formatTime}
      />

      <div className="mt-6">
        <button
          type="button"
          onClick={handleRunDigestNow}
          disabled={isGenerating}
          className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? '生成中...' : '今すぐダイジェストを生成'}
        </button>
      </div>
    </div>
  );
};
