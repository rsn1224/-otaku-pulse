import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useProfileStore } from '../../stores/useProfileStore';

export const ProfileSection: React.FC = () => {
  const { profile, isLoading, error, fetchProfile, updateProfile, resetLearningData } =
    useProfileStore();
  const [displayName, setDisplayName] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [genreInput, setGenreInput] = useState('');
  const [creatorInput, setCreatorInput] = useState('');
  const [titles, setTitles] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [creators, setCreators] = useState<string[]>([]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setTitles(profile.favoriteTitles);
      setGenres(profile.favoriteGenres);
      setCreators(profile.favoriteCreators);
    }
  }, [profile]);

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

  const handleSave = async (): Promise<void> => {
    await updateProfile({
      displayName,
      favoriteTitles: titles,
      favoriteGenres: genres,
      favoriteCreators: creators,
      totalRead: profile?.totalRead ?? 0,
    });
  };

  const renderTagInput = (
    label: string,
    tags: string[],
    tagSetter: (v: string[]) => void,
    input: string,
    inputSetter: (v: string) => void,
  ): React.ReactNode => (
    <div className="mb-5">
      <span className="block text-sm font-medium mb-2 text-[var(--text-primary)]">{label}</span>
      <div className="flex flex-wrap gap-2 mb-2">
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
          placeholder="追加..."
          maxLength={100}
          className="flex-1 px-3 py-1.5 rounded-lg text-sm h-8 bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]"
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

  return (
    <>
      {error && (
        <div className="rounded-lg p-3 mb-4 text-sm bg-[var(--bg-card)] border border-[var(--badge-hot)] text-[var(--badge-hot)]">
          {error}
        </div>
      )}

      <div className="discover-card">
        <div className="mb-5">
          <label
            htmlFor="profile-name"
            className="block text-sm font-medium mb-2 text-[var(--text-primary)]"
          >
            表示名
          </label>
          <input
            id="profile-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm h-9 bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]"
          />
        </div>

        {renderTagInput('好きな作品', titles, setTitles, titleInput, setTitleInput)}
        {renderTagInput('好きなジャンル', genres, setGenres, genreInput, setGenreInput)}
        {renderTagInput('好きなクリエイター', creators, setCreators, creatorInput, setCreatorInput)}

        <p className="text-xs mb-3 text-[var(--text-tertiary)]">
          設定した好みに基づいて For You フィードの記事順が最適化されます
        </p>

        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="card-action-btn primary w-full justify-center py-2"
          style={{ opacity: isLoading ? 0.5 : 1 }}
        >
          {isLoading ? '保存中...' : 'プロフィールを保存'}
        </button>
      </div>

      <div className="discover-card mt-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-[var(--text-primary)]">学習状況</span>
            <p className="text-sm mt-1 text-[var(--text-secondary)]">
              読んだ記事: {profile?.totalRead ?? 0} 件
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('学習データをリセットしますか？')) resetLearningData();
            }}
            className="card-action-btn secondary text-xs text-[var(--badge-hot)]"
          >
            リセット
          </button>
        </div>
      </div>
    </>
  );
};
