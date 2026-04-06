import type React from 'react';
import { useEffect, useState } from 'react';
import { getLatestDigest } from '../../lib/tauri-commands';
import type { DigestDto } from '../../types';
import { TodayViewSection } from '../digest/TodayViewSection';
import { Spinner } from '../ui/Spinner';

const CATEGORIES = ['anime', 'manga', 'game', 'pc', 'weekly_report'] as const;
type DigestCategory = (typeof CATEGORIES)[number];
const CATEGORY_LABEL: Record<DigestCategory, string> = {
  anime: 'アニメ',
  manga: 'マンガ',
  game: 'ゲーム',
  pc: 'PC',
  weekly_report: '週刊',
};

export function DigestWing(): React.JSX.Element {
  const [activeCategory, setActiveCategory] = useState<DigestCategory>('anime');
  const [digest, setDigest] = useState<DigestDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLatestDigest(activeCategory)
      .then((d) => setDigest(d))
      .catch(() => setDigest(null))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  return (
    <div className="h-full flex flex-col bg-(--surface)">
      <TodayViewSection />

      {/* Category tabs */}
      <div className="flex border-b border-(--surface-variant) shrink-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'text-(--primary) border-b-2 border-(--primary)'
                : 'text-(--on-surface-variant) hover:text-(--on-surface)'
            }`}
          >
            {CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : digest === null ? (
          <div className="text-center py-12 text-(--on-surface-variant) text-sm">
            ダイジェストはまだありません
          </div>
        ) : (
          <div className="p-4">
            <p className="text-xs text-(--on-surface-variant) mb-3">
              {new Date(digest.generatedAt).toLocaleDateString('ja-JP', {
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <h2 className="text-base font-semibold mb-3 text-(--on-surface)">{digest.title}</h2>
            {digest.contentHtml ? (
              <div
                className="text-sm leading-relaxed text-(--on-surface)"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: server-generated markdown HTML
                dangerouslySetInnerHTML={{ __html: digest.contentHtml }}
              />
            ) : (
              <p className="text-sm leading-relaxed text-(--on-surface) whitespace-pre-wrap">
                {digest.contentMarkdown}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
