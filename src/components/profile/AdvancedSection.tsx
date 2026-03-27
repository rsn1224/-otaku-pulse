import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { AppearanceSection } from '../settings/AppearanceSection';
import { KeywordFilterSection } from '../settings/KeywordFilterSection';
import { SchedulerSection } from '../settings/SchedulerSection';

export const AdvancedSection: React.FC = () => {
  const handleCleanup = async (): Promise<void> => {
    const days = window.prompt('何日以上前の既読・未ブックマーク記事を削除しますか？');
    if (days && !Number.isNaN(Number(days))) {
      try {
        const deleted = await invoke<number>('cleanup_old_articles', { daysOld: Number(days) });
        window.alert(`${deleted}件削除しました`);
      } catch (err) {
        window.alert(`失敗: ${err instanceof Error ? err.message : '不明なエラー'}`);
      }
    }
  };

  return (
    <>
      <div className="discover-card">
        <span className="block text-sm font-medium mb-3 text-[var(--text-primary)]">外観</span>
        <AppearanceSection />
      </div>

      <div className="discover-card mt-4">
        <span className="block text-sm font-medium mb-3 text-[var(--text-primary)]">
          スケジューラー
        </span>
        <SchedulerSection />
      </div>

      <div className="discover-card mt-4">
        <span className="block text-sm font-medium mb-3 text-[var(--text-primary)]">
          キーワードフィルター
        </span>
        <KeywordFilterSection />
      </div>

      <div className="discover-card mt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            データクリーンアップ
          </span>
          <button
            type="button"
            onClick={handleCleanup}
            className="card-action-btn secondary text-xs"
          >
            古い記事を削除
          </button>
        </div>
        <p className="text-xs mt-2 text-[var(--text-tertiary)]">
          指定日数より前の既読記事を削除（ブックマーク除外）
        </p>
      </div>
    </>
  );
};
