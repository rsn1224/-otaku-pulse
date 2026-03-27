import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import { useProfileStore } from '../../stores/useProfileStore';

interface Suggestion {
  suggestedTitles: string[];
  suggestedGenres: string[];
  suggestedCreators: string[];
  reason: string;
}

interface PreferenceSuggestionProps {
  onClose: () => void;
}

export const PreferenceSuggestion: React.FC<PreferenceSuggestionProps> = ({ onClose }) => {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profile, updateProfile } = useProfileStore();

  useEffect(() => {
    invoke<Suggestion>('suggest_preferences')
      .then(setSuggestion)
      .catch((e) => {
        logger.warn({ error: e }, 'suggestPreferences failed');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [onClose]);

  const handleAccept = async (): Promise<void> => {
    if (!suggestion || !profile) return;
    setSaving(true);

    const merged = {
      ...profile,
      favoriteTitles: [...new Set([...profile.favoriteTitles, ...suggestion.suggestedTitles])],
      favoriteGenres: [...new Set([...profile.favoriteGenres, ...suggestion.suggestedGenres])],
      favoriteCreators: [
        ...new Set([...profile.favoriteCreators, ...suggestion.suggestedCreators]),
      ],
    };

    await updateProfile(merged);
    try {
      await invoke('rescore_articles');
    } catch (e) {
      logger.warn({ error: e }, 'rescoreArticles after preference update failed');
    }
    setSaving(false);
    onClose();
  };

  if (loading) return null;
  if (
    !suggestion ||
    (suggestion.suggestedTitles.length === 0 && suggestion.suggestedGenres.length === 0)
  ) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay click-to-close */}
      <div
        className="fixed inset-0 bg-black/60"
        role="presentation"
        onClick={onClose}
        onKeyDown={() => {}}
      />

      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] animate-[fadeSlideIn_0.3s_ease-out]">
        <div className="px-6 pt-5 pb-3">
          <div className="ai-summary-label mb-2">
            <svg aria-hidden="true" className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            AI Suggestion
          </div>
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            好みが更新されたかもしれません
          </h2>
          <p className="text-xs mt-1 text-[var(--text-secondary)]">{suggestion.reason}</p>
        </div>

        <div className="px-6 pb-4 space-y-3">
          {suggestion.suggestedTitles.length > 0 && (
            <SuggestionGroup label="作品" items={suggestion.suggestedTitles} />
          )}
          {suggestion.suggestedGenres.length > 0 && (
            <SuggestionGroup label="ジャンル" items={suggestion.suggestedGenres} />
          )}
          {suggestion.suggestedCreators.length > 0 && (
            <SuggestionGroup label="クリエイター" items={suggestion.suggestedCreators} />
          )}
        </div>

        <div className="px-6 pb-5 flex items-center justify-between">
          <button type="button" onClick={onClose} className="card-action-btn secondary">
            スキップ
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={saving}
            className={`card-action-btn primary ${saving ? 'opacity-50' : ''}`}
          >
            {saving ? '更新中...' : 'プロフィールに追加'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SuggestionGroup: React.FC<{ label: string; items: string[] }> = ({ label, items }) => (
  <div>
    <span className="text-xs font-medium text-[var(--text-tertiary)]">{label}</span>
    <div className="flex flex-wrap gap-1.5 mt-1">
      {items.map((item) => (
        <span key={item} className="source-badge cat-badge">
          {item}
        </span>
      ))}
    </div>
  </div>
);
