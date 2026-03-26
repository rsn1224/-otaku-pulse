import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useCallback, useState } from 'react';
import { useProfileStore } from '../../stores/useProfileStore';
import type { UserProfileDto } from '../../types';

const GENRE_PRESETS = [
  'アクション',
  'ファンタジー',
  'SF',
  'ラブコメ',
  'ホラー',
  'RPG',
  'FPS',
  'オープンワールド',
  'ストラテジー',
  'インディー',
  '少年漫画',
  '少女漫画',
  'ダークファンタジー',
  '日常系',
  'ロボット',
];

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
    } catch (_) {
      /* silent */
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
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0, 0, 0, 0.7)' }}
      >
        <div className="text-center" style={{ animation: 'fadeSlideIn 0.5s ease-out' }}>
          <p className="text-5xl mb-4">{'🎉'}</p>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Welcome to OtakuPulse!
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            あなた専用のフィードを準備しています...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0" style={{ background: 'rgba(0, 0, 0, 0.7)' }} />

      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          animation: 'fadeSlideIn 0.3s ease-out',
        }}
      >
        {/* Progress */}
        <div className="flex gap-1 px-6 pt-5">
          {STEPS.map((_, i) => (
            <div
              key={`step-${i}`}
              className="flex-1 h-1.5 rounded-full"
              style={{ background: i <= step ? 'var(--accent)' : 'var(--border)' }}
            />
          ))}
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-2">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {STEPS[step].title}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {STEPS[step].subtitle}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 pb-4 min-h-[200px]">
          {step === 0 && (
            <TagInputStep
              tags={titles}
              tagSetter={setTitles}
              input={titleInput}
              inputSetter={setTitleInput}
              addTag={addTag}
              removeTag={removeTag}
              placeholder="作品名を入力..."
            />
          )}
          {step === 1 && (
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                {GENRE_PRESETS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGenre(g)}
                    className="tag-chip"
                    style={
                      genres.includes(g)
                        ? {
                            background: 'var(--accent-soft)',
                            borderColor: 'var(--accent)',
                            color: 'var(--accent)',
                          }
                        : undefined
                    }
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <TagInputStep
              tags={creators}
              tagSetter={setCreators}
              input={creatorInput}
              inputSetter={setCreatorInput}
              addTag={addTag}
              removeTag={removeTag}
              placeholder="クリエイター名を入力..."
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
              className="card-action-btn primary"
              style={{ opacity: saving ? 0.5 : 1 }}
            >
              {saving ? '保存中...' : '始める'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Tag input sub-component
const TagInputStep: React.FC<{
  tags: string[];
  tagSetter: (v: string[]) => void;
  input: string;
  inputSetter: (v: string) => void;
  addTag: (
    input: string,
    setter: (v: string) => void,
    list: string[],
    listSetter: (v: string[]) => void,
  ) => void;
  removeTag: (tag: string, list: string[], listSetter: (v: string[]) => void) => void;
  placeholder: string;
}> = ({ tags, tagSetter, input, inputSetter, addTag, removeTag, placeholder }) => (
  <div>
    <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
          <button
            type="button"
            className="tag-chip-remove"
            onClick={() => removeTag(tag, tags, tagSetter)}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
    <div className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => inputSetter(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag(input, inputSetter, tags, tagSetter);
          }
        }}
        placeholder={placeholder}
        maxLength={100}
        className="flex-1 px-3 py-2 rounded-lg text-sm"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
      />
      <button
        type="button"
        onClick={() => addTag(input, inputSetter, tags, tagSetter)}
        className="card-action-btn primary"
      >
        追加
      </button>
    </div>
  </div>
);
