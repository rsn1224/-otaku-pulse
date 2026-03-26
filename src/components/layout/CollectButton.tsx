import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useState } from 'react';

export const CollectButton: React.FC = () => {
  const [collecting, setCollecting] = useState(false);

  const handleCollect = async (): Promise<void> => {
    setCollecting(true);
    try {
      await invoke('run_collect_now');
      await invoke('rescore_articles');
      await invoke('batch_generate_summaries', { limit: 8 });
    } catch (_) {
      /* silent */
    } finally {
      setCollecting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCollect}
      disabled={collecting}
      className="card-action-btn primary w-full justify-center"
      style={{ opacity: collecting ? 0.5 : 1 }}
    >
      {collecting ? (
        <>
          <div
            className="w-3 h-3 border-2 rounded-full animate-spin"
            style={{ borderColor: 'transparent', borderTopColor: 'currentColor' }}
          />
          収集中...
        </>
      ) : (
        <>
          <svg
            aria-hidden="true"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          収集
        </>
      )}
    </button>
  );
};
