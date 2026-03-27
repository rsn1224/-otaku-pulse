import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useSearchStore } from '../../stores/useSearchStore';

export const TopBarSearch: React.FC = () => {
  const { searchQuery, setSearchQuery, executeSearch, clearSearch, searchMode } = useSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isComposingRef.current) return;
      if (e.key === 'Enter') {
        executeSearch();
      } else if (e.key === 'Escape') {
        clearSearch();
        inputRef.current?.blur();
      }
    },
    [executeSearch, clearSearch],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="topbar-search">
      <svg
        aria-hidden="true"
        className="w-3.5 h-3.5 flex-shrink-0"
        fill="none"
        stroke="var(--text-tertiary)"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        ref={inputRef}
        type="text"
        placeholder="記事を検索...  /"
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
        }}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {searchMode && (
        <button
          type="button"
          onClick={clearSearch}
          className="text-xs flex-shrink-0 text-[var(--text-tertiary)]"
          aria-label="検索をクリア"
        >
          ✕
        </button>
      )}
    </div>
  );
};
