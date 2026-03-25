import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { LlmProvider } from '../../types';

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
      console.error('Failed to load LLM settings:', error);
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
      console.error('Failed to set provider:', error);
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
      console.error('Failed to save API key:', error);
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
        console.error('Failed to set Ollama model:', error);
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
      console.error('Failed to refresh status:', error);
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

      {/* Perplexity Sonar 選択時 */}
      {settings.provider === 'perplexity_sonar' && (
        <div className="space-y-2 p-4 border rounded">
          <div>
            <label htmlFor="perplexity-api-key" className="block text-sm font-medium mb-2">
              API キー:
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pplx-..."
                className="flex-1 px-3 py-2 border rounded"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={handleApiKeySave}
                disabled={isLoading || !apiKey.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                保存
              </button>
            </div>
            <div className="text-sm mt-1">
              {settings.perplexity_api_key_set ? (
                <span className="text-green-600">✅ 設定済み</span>
              ) : (
                <span className="text-yellow-600">⚠️ 未設定</span>
              )}
              <span className="text-gray-500 ml-2">取得先: console.perplexity.ai</span>
            </div>
          </div>
        </div>
      )}

      {/* Ollama 選択時 */}
      {settings.provider === 'ollama' && (
        <div className="space-y-2 p-4 border rounded">
          <div>
            <label htmlFor="ollama-model" className="block text-sm font-medium mb-2">
              モデル:
            </label>
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isLoading || !settings.ollama_running}
              className="w-full px-3 py-2 border rounded disabled:opacity-50"
            >
              {settings.available_ollama_models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm">
            {settings.ollama_running ? (
              <span className="text-green-600">
                🟢 起動中（{settings.available_ollama_models.length}モデル利用可能）
              </span>
            ) : (
              <span className="text-red-600">🔴 未起動</span>
            )}
            <div className="text-gray-500 mt-1">未起動時: ollama serve を実行してください</div>
            <button
              type="button"
              onClick={handleStatusRefresh}
              disabled={isLoading}
              className="mt-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              ステータス再確認
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
