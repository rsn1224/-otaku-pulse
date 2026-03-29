import type React from 'react';
import { useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import {
  getLlmSettings,
  type LlmSettingsResponse,
  setLlmProvider,
  setOllamaSettings,
} from '../../lib/tauri-commands';
import type { LlmProvider } from '../../types';
import { OllamaSettings } from './OllamaSettings';

interface LlmSettingsSectionProps {
  onSettingsChange?: () => void;
}

export const LlmSettingsSection: React.FC<LlmSettingsSectionProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<LlmSettingsResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadSettings = async () => {
    try {
      const llmSettings = await getLlmSettings();
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
      await setLlmProvider(provider);
      await loadSettings();
      onSettingsChange?.();
    } catch (error) {
      logger.error({ error }, 'Failed to set provider');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = async (model: string) => {
    setSelectedModel(model);
    if (settings) {
      setIsLoading(true);
      try {
        await setOllamaSettings(settings.ollama_base_url, model);
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
        <div className="rounded-lg border border-(--outline-variant) p-4">
          <div className="flex items-center gap-2 text-sm">
            {settings.perplexity_api_key_set ? (
              <span className="text-green-400">✅ API キー設定済み</span>
            ) : (
              <span className="text-yellow-400">⚠️ API キー未設定</span>
            )}
          </div>
          <p className="mt-2 text-xs text-(--on-surface-variant)">
            API キーは「API キー」タブで管理できます
          </p>
        </div>
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
