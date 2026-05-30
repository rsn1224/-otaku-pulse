import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import {
  addCustomFeed,
  getAniListSyncStatus,
  getSettings,
  getSteamSyncStatus,
  syncAniListNow,
  syncSteamNow,
  updateSetting,
} from '../../lib/tauri-commands';
import { useToast } from '../common/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type CustomFeedType = 'rss' | 'scraper' | 'custom-api';
type CustomCategory = 'anime' | 'manga' | 'game' | 'tech';

// native select / textarea を Input プリミティブと同じトークンで揃える。
const FIELD_CLASS =
  'w-full text-[0.8125rem] px-3 py-2 rounded-lg bg-(--surface-container) border border-(--outline-variant) text-(--on-surface) focus:outline-none focus:border-(--primary) transition-colors';

export function ExternalServicesSection(): React.JSX.Element {
  const [anilistUsername, setAnilistUsername] = useState('');
  const [steamApiKey, setSteamApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [anilistLastSync, setAnilistLastSync] = useState<string | null>(null);
  const [steamLastSync, setSteamLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<'anilist' | 'steam' | null>(null);
  // カスタムソース (機能B)。既定は config 不要な rss にして、未入力 config での InvalidInput を避ける。
  const [csName, setCsName] = useState('');
  const [csUrl, setCsUrl] = useState('');
  const [csFeedType, setCsFeedType] = useState<CustomFeedType>('rss');
  const [csCategory, setCsCategory] = useState<CustomCategory>('tech');
  const [csConfig, setCsConfig] = useState('');
  const [csSaving, setCsSaving] = useState(false);
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

  const handleAddCustomSource = async () => {
    if (!csName.trim() || !csUrl.trim()) {
      showToast('error', '名前と URL は必須です');
      return;
    }
    setCsSaving(true);
    try {
      await addCustomFeed({
        name: csName.trim(),
        url: csUrl.trim(),
        feedType: csFeedType,
        category: csCategory,
        config: csFeedType === 'rss' ? null : csConfig.trim() || null,
      });
      showToast('success', `カスタムソース「${csName.trim()}」を追加しました`);
      setCsName('');
      setCsUrl('');
      setCsConfig('');
    } catch (e) {
      logger.error({ error: e }, 'addCustomFeed failed');
      showToast('error', 'カスタムソースの追加に失敗しました。URL と設定を確認してください');
    } finally {
      setCsSaving(false);
    }
  };

  const configPlaceholder =
    csFeedType === 'scraper'
      ? '{ "item": "article.post", "title": "h2 a", "link": "h2 a", "summary": "p.excerpt", "base_url": "https://example.com" }'
      : '{ "items_path": "data.items", "title": "title", "link": "url", "summary": "summary", "id": "id" }';

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
      <div className="space-y-3 p-4 rounded-lg bg-(--surface-container)">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">AniList</span>
          <span className="text-xs text-(--on-surface-variant)">視聴リストと記事スコアを連動</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="AniList ユーザー名"
              value={anilistUsername}
              onChange={(e) => setAnilistUsername(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              void handleSaveAniList();
            }}
          >
            保存
          </Button>
          <Button
            variant="secondary"
            size="sm"
            isLoading={syncing === 'anilist'}
            disabled={!anilistUsername.trim()}
            onClick={() => {
              void handleSyncAniList();
            }}
          >
            今すぐ同期
          </Button>
        </div>
        <p className="text-xs text-(--on-surface-variant)">
          最終同期: {formatSync(anilistLastSync)}
        </p>
      </div>

      {/* Steam */}
      <div className="space-y-3 p-4 rounded-lg bg-(--surface-container)">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Steam</span>
          <span className="text-xs text-(--on-surface-variant)">プレイ時間と記事スコアを連動</span>
        </div>
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Steam API Key"
            value={steamApiKey}
            onChange={(e) => setSteamApiKey(e.target.value)}
          />
          <Input
            type="text"
            placeholder="Steam ID (64bit)"
            value={steamId}
            onChange={(e) => setSteamId(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                void handleSaveSteam();
              }}
            >
              保存
            </Button>
            <Button
              variant="secondary"
              size="sm"
              isLoading={syncing === 'steam'}
              disabled={!steamApiKey.trim() || !steamId.trim()}
              onClick={() => {
                void handleSyncSteam();
              }}
            >
              今すぐ同期
            </Button>
          </div>
        </div>
        <p className="text-xs text-(--on-surface-variant)">最終同期: {formatSync(steamLastSync)}</p>
      </div>

      {/* カスタムソース (機能B: 任意サイト/データ収集) */}
      <div className="space-y-3 p-4 rounded-lg bg-(--surface-container)">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">カスタムソース</span>
          <span className="text-xs text-(--on-surface-variant)">
            任意サイト (CSS スクレイピング) / JSON API を収集対象に追加
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            type="text"
            placeholder="ソース名"
            value={csName}
            onChange={(e) => setCsName(e.target.value)}
          />
          <Input
            type="text"
            placeholder="URL"
            value={csUrl}
            onChange={(e) => setCsUrl(e.target.value)}
          />
          <select
            value={csFeedType}
            onChange={(e) => setCsFeedType(e.target.value as CustomFeedType)}
            className={FIELD_CLASS}
          >
            <option value="rss">rss</option>
            <option value="scraper">scraper (HTML)</option>
            <option value="custom-api">custom-api (JSON)</option>
          </select>
          <select
            value={csCategory}
            onChange={(e) => setCsCategory(e.target.value as CustomCategory)}
            className={FIELD_CLASS}
          >
            <option value="tech">tech</option>
            <option value="anime">anime</option>
            <option value="manga">manga</option>
            <option value="game">game</option>
          </select>
        </div>

        {csFeedType !== 'rss' && (
          <textarea
            placeholder={configPlaceholder}
            value={csConfig}
            onChange={(e) => setCsConfig(e.target.value)}
            rows={3}
            className={`${FIELD_CLASS} font-mono text-xs`}
          />
        )}

        <Button
          variant="primary"
          size="sm"
          isLoading={csSaving}
          disabled={!csName.trim() || !csUrl.trim()}
          onClick={() => {
            void handleAddCustomSource();
          }}
        >
          ソースを追加
        </Button>
        <p className="text-xs text-(--on-surface-variant)">
          config は scraper/custom-api のみ必要。追加後、次回の収集サイクルで取得されます。
        </p>
      </div>
    </div>
  );
}
