import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useDiscoverStore } from '../../stores/useDiscoverStore';
import type { DiscoverTab } from '../../types';

const TABS: { id: DiscoverTab; label: string; countKey: string }[] = [
  { id: 'for_you', label: 'For You', countKey: 'forYou' },
  { id: 'trending', label: 'Trending', countKey: 'trending' },
  { id: 'anime', label: 'アニメ', countKey: 'anime' },
  { id: 'game', label: 'ゲーム', countKey: 'game' },
  { id: 'manga', label: '漫画', countKey: 'manga' },
  { id: 'hardware', label: 'ハード', countKey: 'hardware' },
];

export const UniversalTabs: React.FC = () => {
  const tab = useDiscoverStore((s) => s.tab);
  const setTab = useDiscoverStore((s) => s.setTab);
  const unreadCounts = useDiscoverStore((s) => s.unreadCounts);
  const fetchUnreadCounts = useDiscoverStore((s) => s.fetchUnreadCounts);
  const markAllReadCategory = useDiscoverStore((s) => s.markAllReadCategory);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCounts]);

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
    <div ref={tabsRef} className="universal-tabs overflow-x-auto">
      {TABS.map((t) => {
        const count = unreadCounts[t.countKey] ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            onContextMenu={(e) => handleContextMenu(e, t.id)}
            className={`tab-item ${tab === t.id ? 'active' : ''}`}
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
