import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import { RawgSettings } from './RawgSettings';

export const ApiKeysSection: React.FC = () => {
  const [rawgApiKey, setRawgApiKey] = useState('');
  const [rawgKeySet, setRawgKeySet] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkRawgKey = async () => {
    try {
      const isSet = await invoke<boolean>('is_rawg_api_key_set');
      setRawgKeySet(isSet);
    } catch (error) {
      logger.error({ error }, 'Failed to check RAWG API key status');
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: checkRawgKey は安定
  useEffect(() => {
    checkRawgKey();
  }, []);

  const handleSave = async () => {
    if (!rawgApiKey.trim()) return;

    setIsLoading(true);
    try {
      await invoke('set_rawg_api_key', { apiKey: rawgApiKey });
      await checkRawgKey();
      setRawgApiKey('');
    } catch (error) {
      logger.error({ error }, 'Failed to save RAWG API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    setIsLoading(true);
    try {
      await invoke('clear_rawg_api_key');
      await checkRawgKey();
    } catch (error) {
      logger.error({ error }, 'Failed to clear RAWG API key');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">API キー管理</h3>
      <RawgSettings
        apiKey={rawgApiKey}
        setApiKey={setRawgApiKey}
        isLoading={isLoading}
        apiKeySet={rawgKeySet}
        onSave={handleSave}
        onClear={handleClear}
      />
    </div>
  );
};
