import type React from 'react';

interface RawgSettingsProps {
  apiKey: string;
  setApiKey: (v: string) => void;
  isLoading: boolean;
  apiKeySet: boolean;
  onSave: () => void;
  onClear: () => void;
}

export const RawgSettings: React.FC<RawgSettingsProps> = ({
  apiKey,
  setApiKey,
  isLoading,
  apiKeySet,
  onSave,
  onClear,
}) => (
  <div className="space-y-2 p-4 border rounded">
    <div>
      <label htmlFor="rawg-api-key" className="block text-sm font-medium mb-2">
        RAWG API キー:
      </label>
      <div className="flex items-center space-x-2">
        <input
          id="rawg-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="your-rawg-api-key"
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
        {apiKeySet && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('RAWG APIキーを削除しますか？')) onClear();
            }}
            disabled={isLoading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            削除
          </button>
        )}
      </div>
      <div className="text-sm mt-1">
        {apiKeySet ? (
          <span className="text-green-600">✅ 設定済み</span>
        ) : (
          <span className="text-yellow-600">⚠️ 未設定</span>
        )}
        <span className="text-gray-500 ml-2">取得先: rawg.io/apidocs</span>
      </div>
    </div>
  </div>
);
