import type React from 'react';
import type { CardState } from './DiscoverCard';

interface CardActionsProps {
  state: CardState;
  isRead: boolean;
  hasUrl: boolean;
  onDeepDive: () => void | Promise<void>;
  onOpen: () => void;
  onMarkRead: () => void;
}

export const CardActions: React.FC<CardActionsProps> = ({
  state,
  isRead,
  hasUrl,
  onDeepDive,
  onOpen,
  onMarkRead,
}) => {
  if (state === 'collapsed') return null;

  return (
    <div className="flex items-center gap-2 mt-3">
      {(state === 'summary' || state === 'deepdive') && (
        <button type="button" onClick={onDeepDive} className="card-action-btn primary">
          <svg
            aria-hidden="true"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {state === 'deepdive' ? '閉じる' : 'もっと詳しく'}
        </button>
      )}

      <button
        type="button"
        onClick={onOpen}
        disabled={!hasUrl}
        className={`card-action-btn secondary ${!hasUrl ? 'opacity-30 cursor-not-allowed' : ''}`}
      >
        <svg
          aria-hidden="true"
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        開く
      </button>

      <button
        type="button"
        onClick={onMarkRead}
        disabled={isRead}
        className={`card-action-btn secondary ${isRead ? 'opacity-30' : ''}`}
      >
        {isRead ? '既読済' : '既読'}
      </button>
    </div>
  );
};
