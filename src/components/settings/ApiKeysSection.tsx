import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import { PerplexitySettings } from './PerplexitySettings';
import { RawgSettings } from './RawgSettings';

interface LlmSettingsResponse {
  perplexity_api_key_set: boolean;
}

export const ApiKeysSection: React.FC = () => {
  const [rawgApiKey, setRawgApiKey] = useState('');
  const [rawgKeySet, setRawgKeySet] = useState(false);
  const [perplexityApiKey, setPerplexityApiKey] = useState('');
  const [perplexityKeySet, setPerplexityKeySet] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkRawgKey = async () => {
    try {
      const isSet = await invoke<boolean>('is_rawg_api_key_set');
      setRawgKeySet(isSet);
    } catch (error) {
      logger.error({ error }, 'Failed to check RAWG API key status');
    }
  };

  const checkPerplexityKey = async () => {
    try {
      const settings = await invoke<LlmSettingsResponse>('get_llm_settings');
      setPerplexityKeySet(settings.perplexity_api_key_set);
    } catch (error) {
      logger.error({ error }, 'Failed to check Perplexity API key status');
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: check functions are stable
  useEffect(() => {
    checkRawgKey();
    checkPerplexityKey();
  }, []);

  const handleRawgSave = async () => {
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

  const handleRawgClear = async () => {
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

  const handlePerplexitySave = async () => {
    if (!perplexityApiKey.trim()) return;
    setIsLoading(true);
    try {
      await invoke('set_perplexity_api_key', { apiKey: perplexityApiKey });
      await checkPerplexityKey();
      setPerplexityApiKey('');
    } catch (error) {
      logger.error({ error }, 'Failed to save Perplexity API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePerplexityClear = async () => {
    setIsLoading(true);
    try {
      await invoke('clear_perplexity_api_key');
      await checkPerplexityKey();
    } catch (error) {
      logger.error({ error }, 'Failed to clear Perplexity API key');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">API キー管理</h3>
      <PerplexitySettings
        apiKey={perplexityApiKey}
        setApiKey={setPerplexityApiKey}
        isLoading={isLoading}
        apiKeySet={perplexityKeySet}
        onSave={handlePerplexitySave}
        onClear={handlePerplexityClear}
      />
      <RawgSettings
        apiKey={rawgApiKey}
        setApiKey={setRawgApiKey}
        isLoading={isLoading}
        apiKeySet={rawgKeySet}
        onSave={handleRawgSave}
        onClear={handleRawgClear}
      />
    </div>
  );
};
