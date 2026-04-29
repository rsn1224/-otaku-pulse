import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import {
  getAniListSyncStatus,
  getSettings,
  getSteamSyncStatus,
  syncAniListNow,
  syncSteamNow,
  updateSetting,
} from '../../lib/tauri-commands';
import { useToast } from '../common/Toast';

export function ExternalServicesSection(): React.JSX.Element {
  const [anilistUsername, setAnilistUsername] = useState('');
  const [steamApiKey, setSteamApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [anilistLastSync, setAnilistLastSync] = useState<string | null>(null);
  const [steamLastSync, setSteamLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<'anilist' | 'steam' | null>(null);
  const { showToast } = useToast();

  const loadSettings = useCallback(async () => {
    try {
      const [settings, aniSync, steamSync] = await Promise.all([
        getSettings(),
        getAniListSyncStatus(),
        getSteamSyncStatus(),
      ]);
      setAnilistUsername(settings.anilist_username ?? '');
      setSteamApiKey(settings.steam_api_key ?? '');
      setSteamId(settings.steam_id ?? '');
      setAnilistLastSync(aniSync);
      setSteamLastSync(steamSync);
    } catch (e) {
      logger.error({ error: e }, 'ExternalServicesSection load failed');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveAniList = async () => {
    try {
      await updateSetting('anilist_username', anilistUsername.trim());
      showToast('success', 'AniList ユーザー名を保存しました');
    } catch (e) {
      logger.error({ error: e }, 'save anilist_username failed');
      showToast('error', '保存に失敗しました');
    }
  };

  const handleSyncAniList = async () => {
    setSyncing('anilist');
    try {
      const result = await syncAniListNow();
      showToast('success', `AniList 同期完了: ${result}`);
      const status = await getAniListSyncStatus();
      setAnilistLastSync(status);
    } catch (e) {
      logger.error({ error: e }, 'syncAniList failed');
      showToast('error', 'AniList 同期に失敗しました');
    } finally {
      setSyncing(null);
    }
  };

  const handleSaveSteam = async () => {
    try {
      await Promise.all([
        updateSetting('steam_api_key', steamApiKey.trim()),
        updateSetting('steam_id', steamId.trim()),
      ]);
      showToast('success', 'Steam 設定を保存しました');
    } catch (e) {
      logger.error({ error: e }, 'save steam settings failed');
      showToast('error', '保存に失敗しました');
    }
  };

  const handleSyncSteam = async () => {
    setSyncing('steam');
    try {
      const result = await syncSteamNow();
      showToast('success', `Steam 同期完了: ${result}`);
      const status = await getSteamSyncStatus();
      setSteamLastSync(status);
    } catch (e) {
      logger.error({ error: e }, 'syncSteam failed');
      showToast('error', 'Steam 同期に失敗しました');
    } finally {
      setSyncing(null);
    }
  };

  const formatSync = (iso: string | null): string => {
    if (!iso) return '未同期';
    try {
      return new Date(iso).toLocaleString('ja-JP');
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">外部サービス連携</h3>

      {/* AniList */}
      <div className="space-y-3 p-4 rounded-lg bg-(--surface-variant)">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">AniList</span>
          <span className="text-xs text-(--on-surface-variant)">視聴リストと記事スコアを連動</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="AniList ユーザー名"
            value={anilistUsername}
            onChange={(e) => setAnilistUsername(e.target.value)}
            className="flex-1 text-sm px-3 py-1.5 rounded bg-(--surface) border border-(--surface-variant) text-(--on-surface) focus:outline-none focus:ring-1 focus:ring-(--primary)"
          />
          <button
            type="button"
            onClick={handleSaveAniList}
            className="text-xs px-3 py-1.5 rounded bg-(--primary) text-white hover:opacity-90 transition-opacity"
          >
            保存
          </button>
          <button
            type="button"
            onClick={handleSyncAniList}
            disabled={syncing === 'anilist' || !anilistUsername.trim()}
            className="text-xs px-3 py-1.5 rounded bg-(--surface) border border-(--surface-variant) text-(--on-surface) hover:bg-(--surface-hover) transition-colors disabled:opacity-50"
          >
            {syncing === 'anilist' ? '同期中...' : '今すぐ同期'}
          </button>
        </div>
        <p className="text-xs text-(--on-surface-variant)">
          最終同期: {formatSync(anilistLastSync)}
        </p>
      </div>

      {/* Steam */}
      <div className="space-y-3 p-4 rounded-lg bg-(--surface-variant)">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Steam</span>
          <span className="text-xs text-(--on-surface-variant)">プレイ時間と記事スコアを連動</span>
        </div>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Steam API Key"
            value={steamApiKey}
            onChange={(e) => setSteamApiKey(e.target.value)}
            className="w-full text-sm px-3 py-1.5 rounded bg-(--surface) border border-(--surface-variant) text-(--on-surface) focus:outline-none focus:ring-1 focus:ring-(--primary)"
          />
          <input
            type="text"
            placeholder="Steam ID (64bit)"
            value={steamId}
            onChange={(e) => setSteamId(e.target.value)}
            className="w-full text-sm px-3 py-1.5 rounded bg-(--surface) border border-(--surface-variant) text-(--on-surface) focus:outline-none focus:ring-1 focus:ring-(--primary)"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveSteam}
              className="text-xs px-3 py-1.5 rounded bg-(--primary) text-white hover:opacity-90 transition-opacity"
            >
              保存
            </button>
            <button
              type="button"
              onClick={handleSyncSteam}
              disabled={syncing === 'steam' || !steamApiKey.trim() || !steamId.trim()}
              className="text-xs px-3 py-1.5 rounded bg-(--surface) border border-(--surface-variant) text-(--on-surface) hover:bg-(--surface-hover) transition-colors disabled:opacity-50"
            >
              {syncing === 'steam' ? '同期中...' : '今すぐ同期'}
            </button>
          </div>
        </div>
        <p className="text-xs text-(--on-surface-variant)">最終同期: {formatSync(steamLastSync)}</p>
      </div>
    </div>
  );
}
