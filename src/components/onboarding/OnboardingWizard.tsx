import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useCallback, useState } from 'react';
import { logger } from '../../lib/logger';
import { useProfileStore } from '../../stores/useProfileStore';
import type { UserProfileDto } from '../../types';
import { StepCreators } from './StepCreators';
import { StepGenres } from './StepGenres';
import { StepTitles } from './StepTitles';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [titles, setTitles] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [creators, setCreators] = useState<string[]>([]);
  const [titleInput, setTitleInput] = useState('');
  const [creatorInput, setCreatorInput] = useState('');
  const [saving, setSaving] = useState(false);
  const { updateProfile } = useProfileStore();

  const addTag = useCallback(
    (
      input: string,
      setter: (v: string) => void,
      list: string[],
      listSetter: (v: string[]) => void,
    ): void => {
      const trimmed = input.trim();
      if (trimmed && trimmed.length <= 100 && !list.includes(trimmed)) {
        listSetter([...list, trimmed]);
        setter('');
      }
    },
    [],
  );

  const removeTag = useCallback(
    (tag: string, list: string[], listSetter: (v: string[]) => void): void => {
      listSetter(list.filter((t) => t !== tag));
    },
    [],
  );

  const toggleGenre = useCallback((genre: string): void => {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }, []);

  const [showWelcome, setShowWelcome] = useState(false);

  const handleComplete = async (): Promise<void> => {
    setSaving(true);
    const profile: UserProfileDto = {
      displayName: 'オタク',
      favoriteTitles: titles,
      favoriteGenres: genres,
      favoriteCreators: creators,
      totalRead: 0,
    };
    await updateProfile(profile);
    try {
      await invoke('rescore_articles');
    } catch (e) {
      logger.warn({ error: e }, 'rescoreArticles after onboarding failed');
    }
    setSaving(false);
    setShowWelcome(true);
    setTimeout(onComplete, 1500);
  };

  const STEPS = [
    { title: '好きな作品を教えてください', subtitle: 'アニメ・ゲーム・漫画なんでもOK' },
    { title: '好きなジャンルは？', subtitle: 'タップで選択、カスタム入力も可能' },
    { title: '好きなクリエイターは？', subtitle: '監督・声優・ゲームスタジオなど' },
  ];

  if (showWelcome) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="text-center animate-[fadeSlideIn_0.5s_ease-out]">
          <p className="text-5xl mb-4">{'🎉'}</p>
          <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">
            Welcome to OtakuPulse!
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            あなた専用のフィードを準備しています...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/70" />

      <div className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] animate-[fadeSlideIn_0.3s_ease-out]">
        {/* Progress */}
        <div className="flex gap-1 px-6 pt-5">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-2">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{STEPS[step].title}</h2>
          <p className="text-sm mt-1 text-[var(--text-secondary)]">{STEPS[step].subtitle}</p>
        </div>

        {/* Content */}
        <div className="px-6 pb-4 min-h-[200px]">
          {step === 0 && (
            <StepTitles
              titles={titles}
              setTitles={setTitles}
              titleInput={titleInput}
              setTitleInput={setTitleInput}
              addTag={addTag}
              removeTag={removeTag}
            />
          )}
          {step === 1 && <StepGenres genres={genres} toggleGenre={toggleGenre} />}
          {step === 2 && (
            <StepCreators
              creators={creators}
              setCreators={setCreators}
              creatorInput={creatorInput}
              setCreatorInput={setCreatorInput}
              addTag={addTag}
              removeTag={removeTag}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={step > 0 ? () => setStep(step - 1) : onComplete}
            className="card-action-btn secondary"
          >
            {step > 0 ? '戻る' : 'スキップ'}
          </button>
          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="card-action-btn primary"
            >
              次へ
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={saving}
              className={`card-action-btn primary ${saving ? 'opacity-50' : ''}`}
            >
              {saving ? '保存中...' : '始める'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
