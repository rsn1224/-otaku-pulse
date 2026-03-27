import type React from 'react';

interface OllamaSettingsProps {
  selectedModel: string;
  availableModels: string[];
  isRunning: boolean;
  isLoading: boolean;
  onModelChange: (model: string) => void;
  onRefresh: () => void;
}

export const OllamaSettings: React.FC<OllamaSettingsProps> = ({
  selectedModel,
  availableModels,
  isRunning,
  isLoading,
  onModelChange,
  onRefresh,
}) => (
  <div className="space-y-2 p-4 border rounded">
    <div>
      <label htmlFor="ollama-model" className="block text-sm font-medium mb-2">
        モデル:
      </label>
      <select
        id="ollama-model"
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={isLoading || !isRunning}
        className="w-full px-3 py-2 border rounded disabled:opacity-50"
      >
        {availableModels.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
    <div className="text-sm">
      {isRunning ? (
        <span className="text-green-600">🟢 起動中（{availableModels.length}モデル利用可能）</span>
      ) : (
        <span className="text-red-600">🔴 未起動</span>
      )}
      <div className="text-gray-500 mt-1">未起動時: ollama serve を実行してください</div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        className="mt-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
      >
        ステータス再確認
      </button>
    </div>
  </div>
);
