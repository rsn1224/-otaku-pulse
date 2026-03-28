import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { LucideIcon } from 'lucide-react';
import { Bookmark, CalendarDays, Library, Search, User } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { logger } from '../../lib/logger';
import { springTransition } from '../../lib/motion-variants';
import { useArticleStore } from '../../stores/useArticleStore';
import { useFilterStore } from '../../stores/useFilterStore';
import { initTheme } from '../../stores/useThemeStore';
import type { WingIdV2 } from '../../types';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { KeyboardHelpModal } from '../common/KeyboardHelpModal';
import { OnboardingWizard } from '../onboarding/OnboardingWizard';
import { PreferenceSuggestion } from '../onboarding/PreferenceSuggestion';
import { Spinner } from '../ui/Spinner';
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

const NAV_ITEMS: { id: WingIdV2; label: string; Icon: LucideIcon }[] = [
  { id: 'discover', label: 'Discover', Icon: Search },
  { id: 'library', label: 'Library', Icon: Library },
  { id: 'saved', label: 'Saved', Icon: Bookmark },
  { id: 'schedule', label: 'Schedule', Icon: CalendarDays },
  { id: 'profile', label: 'Profile', Icon: User },
];

export function AppShell(): React.JSX.Element {
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
      .catch((e) => logger.debug({ error: e }, 'getUserProfile failed'));
  }, []);

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        await invoke('init_default_feeds');
        await invoke('run_collect_now');
        await invoke('rescore_articles');
        await invoke('batch_generate_summaries', { limit: 10 });
      } catch (e) {
        logger.debug({ error: e }, 'initCollect failed, scheduler will retry');
      }
    };
    init();
  }, []);

  const { fetchFeed, fetchHighlights } = useArticleStore();
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
        .catch((e) => logger.debug({ error: e }, 'getUserProfile in collect-completed failed'));
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
      <div className="h-screen flex flex-col bg-(--surface) text-(--on-surface)">
        <div className="topbar" data-tauri-drag-region>
          <div className="flex items-center gap-3" data-tauri-drag-region>
            <span className="text-sm font-semibold tracking-tight" data-tauri-drag-region>
              OtakuPulse
            </span>
          </div>
          <TopBarSearch />
          <WindowControls />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <nav className="w-[60px] flex flex-col items-center py-6 flex-shrink-0 space-y-2 bg-[rgba(19,19,25,0.9)] backdrop-blur-[20px] shadow-[40px_0_40px_-20px_rgba(189,157,255,0.06)]">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold mb-4 bg-linear-to-br from-(--primary) to-(--secondary) text-white">
              OP
            </div>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveWing(item.id)}
                className={`relative flex items-center justify-center w-full h-11 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary) focus-visible:rounded-lg ${activeWing === item.id ? 'text-(--primary) bg-(--primary-soft) shadow-[inset_0_0_16px_var(--glow-secondary)]' : 'text-(--on-surface-variant) hover:text-(--on-surface) hover:bg-(--surface-hover)'}`}
                title={item.label}
                aria-label={item.label}
              >
                {activeWing === item.id && (
                  <motion.span
                    layoutId="nav-indicator"
                    transition={springTransition}
                    className="absolute left-0 w-[3px] h-7 bg-(--primary) rounded-r-sm"
                  />
                )}
                <item.Icon size={20} aria-hidden="true" className="relative z-10" />
              </button>
            ))}
            <div className="mt-auto">
              <CollectButton />
            </div>
          </nav>
          <main id="main-content" className="flex-1 overflow-hidden">
            <React.Suspense
              fallback={
                <div className="flex items-center justify-center h-full bg-(--surface)">
                  <Spinner />
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
}
