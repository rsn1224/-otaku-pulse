import type React from 'react';
import { useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import {
  clearPerplexityApiKey,
  clearRawgApiKey,
  getLlmSettings,
  isRawgApiKeySet,
} from '../../lib/tauri-commands';
import { useToast } from '../common/Toast';
import { PerplexitySettings } from './PerplexitySettings';
import { RawgSettings } from './RawgSettings';

export const ApiKeysSection: React.FC = () => {
  const [rawgApiKey, setRawgApiKey] = useState('');
  const [rawgKeySet, setRawgKeySet] = useState(false);
  const [perplexityApiKey, setPerplexityApiKey] = useState('');
  const [perplexityKeySet, setPerplexityKeySet] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  const checkRawgKey = async () => {
    try {
      const isSet = await isRawgApiKeySet();
      setRawgKeySet(isSet);
    } catch (error) {
      logger.error({ error }, 'Failed to check RAWG API key status');
    }
  };

  const checkPerplexityKey = async () => {
    try {
      const settings = await getLlmSettings();
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
      await setRawgApiKey(rawgApiKey);
      await checkRawgKey();
      setRawgApiKey('');
      showToast('success', 'RAWG API キーを保存しました');
    } catch (error) {
      logger.error({ error }, 'Failed to save RAWG API key');
      showToast('error', 'RAWG API キーの保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRawgClear = async () => {
    setIsLoading(true);
    try {
      await clearRawgApiKey();
      await checkRawgKey();
      showToast('success', 'RAWG API キーを削除しました');
    } catch (error) {
      logger.error({ error }, 'Failed to clear RAWG API key');
      showToast('error', 'RAWG API キーの削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePerplexitySave = async () => {
    if (!perplexityApiKey.trim()) return;
    setIsLoading(true);
    try {
      await setPerplexityApiKey(perplexityApiKey);
      await checkPerplexityKey();
      setPerplexityApiKey('');
      showToast('success', 'Perplexity API キーを保存しました');
    } catch (error) {
      logger.error({ error }, 'Failed to save Perplexity API key');
      showToast('error', 'Perplexity API キーの保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePerplexityClear = async () => {
    setIsLoading(true);
    try {
      await clearPerplexityApiKey();
      await checkPerplexityKey();
      showToast('success', 'Perplexity API キーを削除しました');
    } catch (error) {
      logger.error({ error }, 'Failed to clear Perplexity API key');
      showToast('error', 'Perplexity API キーの削除に失敗しました');
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
