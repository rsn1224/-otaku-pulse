import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import React, { useEffect, useState } from 'react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useDiscoverStore } from '../../stores/useDiscoverStore';
import { useFilterStore } from '../../stores/useFilterStore';
import { initTheme } from '../../stores/useThemeStore';
import type { WingIdV2 } from '../../types';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { KeyboardHelpModal } from '../common/KeyboardHelpModal';
import { OnboardingWizard } from '../onboarding/OnboardingWizard';
import { PreferenceSuggestion } from '../onboarding/PreferenceSuggestion';
import { CollectButton } from './CollectButton';
import { TopBarSearch } from './TopBarSearch';
import { WindowControls } from './WindowControls';

const DiscoverWing = React.lazy(() =>
  import('../wings/DiscoverWing').then((m) => ({ default: m.DiscoverWing })),
);
const LibraryWing = React.lazy(() =>
  import('../wings/LibraryWing').then((m) => ({ default: m.LibraryWing })),
);
const ProfileWing = React.lazy(() =>
  import('../wings/ProfileWing').then((m) => ({ default: m.ProfileWing })),
);
const SavedWing = React.lazy(() =>
  import('../wings/SavedWing').then((m) => ({ default: m.SavedWing })),
);
const ScheduleWing = React.lazy(() =>
  import('../wings/ScheduleWing').then((m) => ({ default: m.ScheduleWing })),
);

const NAV_ITEMS: { id: WingIdV2; label: string; icon: string }[] = [
  { id: 'discover', label: 'Discover', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'library', label: 'Library', icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' },
  {
    id: 'saved',
    label: 'Saved',
    icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
];

export const AppShell: React.FC = () => {
  const [activeWing, setActiveWing] = useState<WingIdV2>('discover');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);

  useEffect(() => {
    initTheme();
    useFilterStore.getState().fetchFilters();
  }, []);
  useKeyboardShortcuts();

  // 初回起動判定: プロフィール未設定ならウィザード表示
  useEffect(() => {
    invoke<{ totalRead: number; favoriteTitles: string[] }>('get_user_profile')
      .then((p) => {
        if (p.totalRead === 0 && p.favoriteTitles.length === 0) {
          setShowOnboarding(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        await invoke('init_default_feeds');
        await invoke('run_collect_now');
        await invoke('rescore_articles');
        await invoke('batch_generate_summaries', { limit: 10 });
      } catch (_) {
        /* スケジューラーが後で処理 */
      }
    };
    init();
  }, []);

  const { fetchFeed, fetchHighlights } = useDiscoverStore();
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen('collect-completed', () => {
      fetchFeed(true);
      fetchHighlights();
      // 定期好み提案: 50 記事ごとにチェック
      invoke<{ totalRead: number }>('get_user_profile')
        .then((p) => {
          if (p.totalRead > 0 && p.totalRead % 50 === 0) {
            setShowSuggestion(true);
          }
        })
        .catch(() => {});
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [fetchFeed, fetchHighlights]);

  const renderWing = (): React.ReactNode => {
    switch (activeWing) {
      case 'discover':
        return <DiscoverWing />;
      case 'library':
        return <LibraryWing />;
      case 'saved':
        return <SavedWing />;
      case 'schedule':
        return <ScheduleWing />;
      case 'profile':
        return <ProfileWing />;
      default:
        return <DiscoverWing />;
    }
  };

  return (
    <ErrorBoundary>
      <div
        className="h-screen flex flex-col"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <div className="topbar" data-tauri-drag-region>
          <div className="flex items-center gap-3" data-tauri-drag-region>
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              O
            </div>
            <span className="text-sm font-semibold" data-tauri-drag-region>
              OtakuPulse
            </span>
          </div>
          <TopBarSearch />
          <WindowControls />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <nav
            className="w-44 flex flex-col py-4 px-2 flex-shrink-0"
            style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveWing(item.id)}
                className={`nav-item ${activeWing === item.id ? 'active' : ''}`}
              >
                <svg
                  aria-hidden="true"
                  className="w-[18px] h-[18px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
            <div className="mt-auto px-1">
              <CollectButton />
            </div>
          </nav>
          <main className="flex-1 overflow-hidden">
            <React.Suspense
              fallback={
                <div
                  className="flex items-center justify-center h-full"
                  style={{ background: 'var(--bg-primary)' }}
                >
                  <div
                    className="w-6 h-6 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
                  />
                </div>
              }
            >
              {renderWing()}
            </React.Suspense>
          </main>
        </div>
      </div>

      <KeyboardHelpModal />

      {/* Onboarding Wizard */}
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      {showSuggestion && !showOnboarding && (
        <PreferenceSuggestion onClose={() => setShowSuggestion(false)} />
      )}
    </ErrorBoundary>
  );
};
