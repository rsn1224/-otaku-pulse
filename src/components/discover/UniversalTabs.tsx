import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useArticleStore } from '../../stores/useArticleStore';
import type { DiscoverTab } from '../../types';

const TABS: { id: DiscoverTab; label: string; countKey: string }[] = [
  { id: 'for_you', label: 'For You', countKey: 'forYou' },
  { id: 'trending', label: 'Trending', countKey: 'trending' },
  { id: 'popular', label: 'Popular', countKey: 'popular' },
  { id: 'most_viewed', label: 'Most Viewed', countKey: 'mostViewed' },
  { id: 'anime', label: 'アニメ', countKey: 'anime' },
  { id: 'game', label: 'ゲーム', countKey: 'game' },
  { id: 'manga', label: '漫画', countKey: 'manga' },
  { id: 'hardware', label: 'ハード', countKey: 'hardware' },
];

export const UniversalTabs: React.FC = () => {
  const tab = useArticleStore((s) => s.tab);
  const setTab = useArticleStore((s) => s.setTab);
  const unreadCounts = useArticleStore((s) => s.unreadCounts);
  const fetchUnreadCounts = useArticleStore((s) => s.fetchUnreadCounts);
  const markAllReadCategory = useArticleStore((s) => s.markAllReadCategory);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCounts]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to active tab when tab changes
  useEffect(() => {
    const el = tabsRef.current?.querySelector('.active');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [tab]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      if (window.confirm('このカテゴリの記事を全て既読にしますか？')) {
        markAllReadCategory(tabId);
      }
    },
    [markAllReadCategory],
  );

  return (
    <div ref={tabsRef} className="universal-tabs overflow-x-auto" role="tablist">
      {TABS.map((t) => {
        const count = unreadCounts[t.countKey] ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            onContextMenu={(e) => handleContextMenu(e, t.id)}
            className={`tab-item focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary) focus-visible:rounded ${tab === t.id ? 'active' : ''}`}
            title="右クリックで全既読"
          >
            {t.label}
            {count > 0 && <span className="tab-badge">{count}</span>}
          </button>
        );
      })}
    </div>
  );
};
