import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { initTheme } from '../../stores/useThemeStore';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';

// Wing components
const DashboardWing = React.lazy(() =>
  import('../wings/DashboardWing').then((module) => ({ default: module.DashboardWing })),
);
const NewsWing = React.lazy(() =>
  import('../wings/NewsWing').then((module) => ({ default: module.NewsWing })),
);
const DigestWing = React.lazy(() =>
  import('../../wings/DigestWing').then((module) => ({ default: module.DigestWing })),
);
const SavedWing = React.lazy(() =>
  import('../wings/SavedWing').then((module) => ({ default: module.SavedWing })),
);
const ScheduleWing = React.lazy(() =>
  import('../wings/ScheduleWing').then((module) => ({ default: module.ScheduleWing })),
);
const SettingsWing = React.lazy(() =>
  import('../wings/SettingsWing').then((module) => ({ default: module.SettingsWing })),
);

export const AppShell: React.FC = () => {
  const [activeWing, setActiveWing] = useState('news'); // デフォルトをnewsに変更

  // テーマ初期化
  useEffect(() => {
    initTheme();
  }, []);

  // キーボードショートカットを有効化
  useKeyboardShortcuts();

  // 初回起動時の初期化
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // デフォルトフィードを初期化
        await invoke('init_default_feeds');

        // バックグラウンドでデータ収集を実行
        await invoke('run_collect_now');
      } catch (error) {
        console.error('App initialization failed:', error);
      }
    };

    initializeApp();
  }, []);

  const renderWing = () => {
    switch (activeWing) {
      case 'dashboard':
        return (
          <React.Suspense fallback={<div className="p-8">Loading...</div>}>
            <DashboardWing />
          </React.Suspense>
        );
      case 'news':
        return (
          <React.Suspense fallback={<div className="p-8">Loading...</div>}>
            <NewsWing />
          </React.Suspense>
        );
      case 'digest':
        return (
          <React.Suspense fallback={<div className="p-8">Loading...</div>}>
            <DigestWing />
          </React.Suspense>
        );
      case 'saved':
        return (
          <React.Suspense fallback={<div className="p-8">Loading...</div>}>
            <SavedWing />
          </React.Suspense>
        );
      case 'schedule':
        return (
          <React.Suspense fallback={<div className="p-8">Loading...</div>}>
            <ScheduleWing />
          </React.Suspense>
        );
      case 'settings':
        return (
          <React.Suspense fallback={<div className="p-8">Loading...</div>}>
            <SettingsWing />
          </React.Suspense>
        );
      default:
        return (
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-4">Unknown Wing</h2>
            <p>Selected wing: {activeWing}</p>
          </div>
        );
    }
  };

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <TitleBar />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeWing={activeWing} onWingChange={setActiveWing} />

          <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">{renderWing()}</main>
        </div>
      </div>
    </ErrorBoundary>
  );
};
