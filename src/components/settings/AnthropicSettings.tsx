import { Button } from '../ui/Button';

interface AnthropicSettingsProps {
  apiKey: string;
  setApiKey: (v: string) => void;
  isLoading: boolean;
  apiKeySet: boolean;
  onSave: () => void;
  onClear: () => void;
}

export function AnthropicSettings({
  apiKey,
  setApiKey,
  isLoading,
  apiKeySet,
  onSave,
  onClear,
}: AnthropicSettingsProps) {
  return (
    <div className="space-y-2 p-4 rounded-lg border border-(--outline-variant) bg-(--surface-container)">
      <div>
        <label
          htmlFor="anthropic-api-key"
          className="block text-sm font-medium mb-2 text-(--on-surface)"
        >
          Claude (Anthropic) API キー:
        </label>
        <div className="flex items-center gap-2">
          <input
            id="anthropic-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 rounded-lg bg-(--surface) border border-(--outline-variant) text-(--on-surface) text-[0.8125rem] outline-none transition-colors duration-150 focus:border-(--primary) placeholder:text-(--outline) disabled:opacity-50"
          />
          <Button
            variant="primary"
            onClick={onSave}
            disabled={isLoading || !apiKey.trim()}
            isLoading={isLoading}
          >
            保存
          </Button>
          {apiKeySet && (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm('Claude API キーを削除しますか？')) onClear();
              }}
              disabled={isLoading}
            >
              削除
            </Button>
          )}
        </div>
        <div className="text-sm mt-1 flex items-center gap-2">
          {apiKeySet ? (
            <span className="text-(--primary)">設定済み</span>
          ) : (
            <span className="text-(--on-surface-variant)">未設定</span>
          )}
          <span className="text-(--outline)">取得先: console.anthropic.com</span>
        </div>
      </div>
    </div>
  );
}
