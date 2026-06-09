import { Button } from '../ui/Button';

interface AnthropicSettingsProps {
  apiKey: string;
  setApiKey: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  isLoading: boolean;
  apiKeySet: boolean;
  onSave: () => void;
  onClear: () => void;
  onModelSave: () => void;
}

const PRESET_MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { id: 'claude-fable-5', label: 'Fable 5' },
] as const;

const CUSTOM_VALUE = 'custom';

const FIELD_CLASS =
  'flex-1 px-3 py-2 rounded-lg bg-(--surface) border border-(--outline-variant) text-(--on-surface) text-[0.8125rem] outline-none transition-colors duration-150 focus:border-(--primary) hover:border-(--outline) placeholder:text-(--outline) disabled:opacity-50 disabled:pointer-events-none';

export function AnthropicSettings({
  apiKey,
  setApiKey,
  model,
  setModel,
  isLoading,
  apiKeySet,
  onSave,
  onClear,
  onModelSave,
}: AnthropicSettingsProps) {
  const isPreset = PRESET_MODELS.some((m) => m.id === model);
  const showCustom = !isPreset;

  const handleSelectChange = (value: string) => {
    // "カスタム…" 選択時は空にしてテキスト入力へ切替。プリセットは即反映。
    setModel(value === CUSTOM_VALUE ? '' : value);
  };

  return (
    <div className="space-y-3 p-4 rounded-lg border border-(--outline-variant) bg-(--surface-container)">
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
            className={FIELD_CLASS}
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

      <div>
        <label
          htmlFor="anthropic-model"
          className="block text-sm font-medium mb-2 text-(--on-surface)"
        >
          モデル:
        </label>
        <div className="flex items-center gap-2">
          <select
            id="anthropic-model"
            value={showCustom ? CUSTOM_VALUE : model}
            onChange={(e) => handleSelectChange(e.target.value)}
            disabled={isLoading}
            className={`${FIELD_CLASS} cursor-pointer`}
          >
            {PRESET_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
            <option value={CUSTOM_VALUE}>カスタム…</option>
          </select>
          <Button
            variant="primary"
            onClick={onModelSave}
            disabled={isLoading || !model.trim()}
            isLoading={isLoading}
          >
            保存
          </Button>
        </div>
        {showCustom && (
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="claude-..."
            disabled={isLoading}
            className={`${FIELD_CLASS} w-full mt-2`}
          />
        )}
        <p className="text-sm mt-1 text-(--on-surface-variant)">
          現在: <span className="text-(--on-surface)">{model || '未設定'}</span>
        </p>
      </div>
    </div>
  );
}
