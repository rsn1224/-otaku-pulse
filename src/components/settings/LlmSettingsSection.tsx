import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import type { LlmProvider } from '../../types';
import { OllamaSettings } from './OllamaSettings';
import { PerplexitySettings } from './PerplexitySettings';

interface LlmSettings {
  provider: LlmProvider;
  perplexity_api_key_set: boolean;
  ollama_base_url: string;
  ollama_model: string;
  available_ollama_models: string[];
  ollama_running: boolean;
}

interface LlmSettingsSectionProps {
  onSettingsChange?: () => void;
}

export const LlmSettingsSection: React.FC<LlmSettingsSectionProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<LlmSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadSettings = async () => {
    try {
      const llmSettings = await invoke<LlmSettings>('get_llm_settings');
      setSettings(llmSettings);
      setSelectedModel(llmSettings.ollama_model);
    } catch (error) {
      logger.error({ error }, 'Failed to load LLM settings');
    }
  };

  // マウント時に設定取得
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadSettings は安定
  useEffect(() => {
    loadSettings();
  }, []);

  const handleProviderChange = async (provider: LlmProvider) => {
    setIsLoading(true);
    try {
      await invoke('set_llm_provider', { provider });
      await loadSettings();
      onSettingsChange?.();
    } catch (error) {
      logger.error({ error }, 'Failed to set provider');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeySave = async () => {
    if (!apiKey.trim()) return;

    setIsLoading(true);
    try {
      await invoke('set_perplexity_api_key', { apiKey });
      await loadSettings();
      onSettingsChange?.();
      setApiKey(''); // 入力クリア
    } catch (error) {
      logger.error({ error }, 'Failed to save API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeyClear = async () => {
    setIsLoading(true);
    try {
      await invoke('clear_perplexity_api_key');
      await loadSettings();
      onSettingsChange?.();
    } catch (error) {
      logger.error({ error }, 'Failed to clear API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = async (model: string) => {
    setSelectedModel(model);
    if (settings) {
      setIsLoading(true);
      try {
        await invoke('set_ollama_settings', {
          baseUrl: settings.ollama_base_url,
          model,
        });
        await loadSettings();
        onSettingsChange?.();
      } catch (error) {
        logger.error({ error }, 'Failed to set Ollama model');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleStatusRefresh = async () => {
    setIsLoading(true);
    try {
      await loadSettings();
    } catch (error) {
      logger.error({ error }, 'Failed to refresh status');
    } finally {
      setIsLoading(false);
    }
  };

  if (!settings) {
    return <div className="p-4">読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="llm-provider" className="block text-sm font-medium mb-2">
          プロバイダー:
        </label>
        <div className="space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              value="perplexity_sonar"
              checked={settings.provider === 'perplexity_sonar'}
              onChange={(e) => handleProviderChange(e.target.value as LlmProvider)}
              disabled={isLoading}
              className="mr-2"
            />
            Perplexity Sonar
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              value="ollama"
              checked={settings.provider === 'ollama'}
              onChange={(e) => handleProviderChange(e.target.value as LlmProvider)}
              disabled={isLoading}
              className="mr-2"
            />
            Ollama（ローカル）
          </label>
        </div>
      </div>

      {settings.provider === 'perplexity_sonar' && (
        <PerplexitySettings
          apiKey={apiKey}
          setApiKey={setApiKey}
          isLoading={isLoading}
          apiKeySet={settings.perplexity_api_key_set}
          onSave={handleApiKeySave}
          onClear={handleApiKeyClear}
        />
      )}

      {settings.provider === 'ollama' && (
        <OllamaSettings
          selectedModel={selectedModel}
          availableModels={settings.available_ollama_models}
          isRunning={settings.ollama_running}
          isLoading={isLoading}
          onModelChange={handleModelChange}
          onRefresh={handleStatusRefresh}
        />
      )}
    </div>
  );
};
