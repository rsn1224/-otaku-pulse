import type React from 'react';
import { useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import { getLatestDigest, runResearchReport } from '../../lib/tauri-commands';
import type { DigestDto } from '../../types';
import { useToast } from '../common/Toast';
import { TodayViewSection } from '../digest/TodayViewSection';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { ScheduleWing } from './ScheduleWing';

// ADR-10: Digest = ダイジェスト + Schedule（放送カレンダー/ゲーム発売）。トップタブで切替。
type DigestView = 'digest' | 'schedule';

// digest 対象は anime/manga/game/tech + 特殊 (weekly_report / research_report)。
// 'pc' (ハードウェアニュース) は Discover の hardware タブで閲覧する browse-only カテゴリで、
// digest 生成のみ対象外 (記事は収集・閲覧される)。機能A の PC 状態パネルとは別物。
const CATEGORIES = ['anime', 'manga', 'game', 'tech', 'weekly_report', 'research_report'] as const;
type DigestCategory = (typeof CATEGORIES)[number];
const CATEGORY_LABEL: Record<DigestCategory, string> = {
  anime: 'アニメ',
  manga: 'マンガ',
  game: 'ゲーム',
  tech: 'テック',
  weekly_report: '週刊',
  research_report: '調査',
};

export function DigestWing(): React.JSX.Element {
  const [view, setView] = useState<DigestView>('digest');
  const [activeCategory, setActiveCategory] = useState<DigestCategory>('anime');
  const [digest, setDigest] = useState<DigestDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [researchQuery, setResearchQuery] = useState('');
  const [generating, setGenerating] = useState(false);
  const { showToast } = useToast();

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload は調査レポート生成後の再取得トリガー用の意図的な依存
  useEffect(() => {
    setLoading(true);
    getLatestDigest(activeCategory)
      .then((d) => setDigest(d))
      .catch(() => setDigest(null))
      .finally(() => setLoading(false));
  }, [activeCategory, reload]);

  const handleGenerateResearch = async () => {
    if (!researchQuery.trim()) {
      showToast('error', '調査クエリを入力してください');
      return;
    }
    setGenerating(true);
    try {
      const msg = await runResearchReport(researchQuery.trim());
      showToast('success', msg);
      setReload((n) => n + 1);
    } catch (e) {
      logger.error({ error: e }, 'runResearchReport failed');
      showToast('error', '調査レポートの生成に失敗しました。しばらくして再試行してください');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-(--surface)">
      {/* ADR-10: トップタブ（ダイジェスト / カレンダー） */}
      <div className="flex border-b border-(--outline-variant) shrink-0">
        {(
          [
            ['digest', 'ダイジェスト'],
            ['schedule', 'カレンダー'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              view === id
                ? 'text-(--primary) border-b-2 border-(--primary)'
                : 'text-(--on-surface-variant) hover:text-(--on-surface)'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'schedule' ? (
        <div className="flex-1 min-h-0">
          <ScheduleWing />
        </div>
      ) : (
        <>
          <TodayViewSection />

          {/* Category tabs */}
          <div className="flex border-b border-(--outline-variant) shrink-0">
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
            {activeCategory === 'research_report' && (
              <div className="p-4 border-b border-(--outline-variant) space-y-2">
                <p className="text-xs text-(--on-surface-variant)">
                  任意のトピックを Web 検索付きで調査し、出典付きレポートを生成します (Perplexity
                  API Key が必要)。
                </p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="text"
                      placeholder="調査したいトピック (例: Tauri v2 の最新動向)"
                      value={researchQuery}
                      onChange={(e) => setResearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !generating) {
                          void handleGenerateResearch();
                        }
                      }}
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={generating}
                    disabled={!researchQuery.trim()}
                    onClick={() => {
                      void handleGenerateResearch();
                    }}
                  >
                    調査
                  </Button>
                </div>
              </div>
            )}
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
        </>
      )}
    </div>
  );
}
