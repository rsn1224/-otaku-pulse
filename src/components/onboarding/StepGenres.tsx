import type React from 'react';

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

interface StepGenresProps {
  genres: string[];
  toggleGenre: (genre: string) => void;
}

export const StepGenres: React.FC<StepGenresProps> = ({ genres, toggleGenre }) => (
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
);
