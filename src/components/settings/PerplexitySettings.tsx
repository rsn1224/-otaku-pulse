import type React from 'react';

interface PerplexitySettingsProps {
  apiKey: string;
  setApiKey: (v: string) => void;
  isLoading: boolean;
  apiKeySet: boolean;
  onSave: () => void;
}

export const PerplexitySettings: React.FC<PerplexitySettingsProps> = ({
  apiKey,
  setApiKey,
  isLoading,
  apiKeySet,
  onSave,
}) => (
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
          onClick={onSave}
          disabled={isLoading || !apiKey.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          保存
        </button>
      </div>
      <div className="text-sm mt-1">
        {apiKeySet ? (
          <span className="text-green-600">✅ 設定済み</span>
        ) : (
          <span className="text-yellow-600">⚠️ 未設定</span>
        )}
        <span className="text-gray-500 ml-2">取得先: console.perplexity.ai</span>
      </div>
    </div>
  </div>
);
