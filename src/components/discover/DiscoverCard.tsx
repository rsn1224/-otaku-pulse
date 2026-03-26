import { invoke } from '@tauri-apps/api/core';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { stripCitations } from '../../lib/textUtils';
import { useDiscoverStore } from '../../stores/useDiscoverStore';
import type { DiscoverArticleDto } from '../../types';
import { DeepDivePanel } from './DeepDivePanel';
import { SummarySkeleton } from './SummarySkeleton';

type CardState = 'collapsed' | 'summary' | 'deepdive';

const formatRelativeTime = (publishedAt: string | null): string => {
  if (!publishedAt) return '';
  const date = new Date(publishedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const rtf = new Intl.RelativeTimeFormat('ja', { numeric: 'auto' });

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return rtf.format(-diffMinutes, 'minute');
  }
  if (diffHours < 24) {
    return rtf.format(-diffHours, 'hour');
  }
  const diffDays = Math.floor(diffHours / 24);
  return rtf.format(-diffDays, 'day');
};

const CATEGORY_LABELS: Record<string, string> = {
  anime: 'アニメ',
  manga: '漫画',
  game: 'ゲーム',
  pc: 'ハード',
};

const estimateReadTime = (text: string | null): string | null => {
  if (!text) return null;
  const minutes = Math.max(1, Math.ceil(text.length / 500));
  return `${minutes}分`;
};

interface DiscoverCardProps {
  article: DiscoverArticleDto;
  featured?: boolean;
}

const DiscoverCardInner: React.FC<DiscoverCardProps> = ({ article, featured = false }) => {
  const [state, setState] = useState<CardState>('collapsed');
  const [summary, setSummary] = useState<string | null>(article.aiSummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryAttempted, setSummaryAttempted] = useState(!!article.aiSummary);
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dwellStart = useRef<number>(0);

  const markRead = useDiscoverStore((s) => s.markRead);
  const toggleBookmark = useDiscoverStore((s) => s.toggleBookmark);
  const recordInteraction = useDiscoverStore((s) => s.recordInteraction);
  const updateArticleSummary = useDiscoverStore((s) => s.updateArticleSummary);
  const openReader = useDiscoverStore((s) => s.openReader);

  // 統合 IntersectionObserver: AI サマリー生成 + Dwell time 計測
  useEffect(() => {
    if (summary || summaryAttempted) {
      setState('summary');
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Dwell tracking: 表示開始
          if (dwellStart.current === 0) {
            dwellStart.current = Date.now();
          }
          // AI サマリー: 1回のみ試行
          if (!summary && !summaryLoading && !summaryAttempted) {
            setSummaryLoading(true);
            setSummaryAttempted(true);
            invoke<string>('get_or_generate_summary', { articleId: article.id })
              .then((s) => {
                setSummary(s);
                updateArticleSummary(article.id, s);
                setState('summary');
              })
              .catch(() => {
                setState('summary');
              })
              .finally(() => setSummaryLoading(false));
          }
        } else if (dwellStart.current > 0) {
          // Dwell tracking: 表示終了
          const seconds = Math.floor((Date.now() - dwellStart.current) / 1000);
          if (seconds >= 2) {
            recordInteraction(article.id, 'view', seconds);
          }
          dwellStart.current = 0;
        }
      },
      { threshold: 0.3 },
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [
    article.id,
    summary,
    summaryLoading,
    summaryAttempted,
    updateArticleSummary,
    recordInteraction,
  ]);

  const handleOpen = useCallback((): void => {
    openReader(article.id);
  }, [article.id, openReader]);

  const bookmarkingRef = useRef(false);
  const handleBookmark = useCallback((): void => {
    if (bookmarkingRef.current) return;
    bookmarkingRef.current = true;
    toggleBookmark(article.id);
    recordInteraction(article.id, 'bookmark');
    setTimeout(() => {
      bookmarkingRef.current = false;
    }, 500);
  }, [article.id, toggleBookmark, recordInteraction]);

  const handleDeepDive = useCallback(async (): Promise<void> => {
    // トグル: deepdive → summary に戻す
    if (state === 'deepdive') {
      setState('summary');
      return;
    }
    setQuestions([]);
    setState('deepdive');
    setQuestionsLoading(true);
    recordInteraction(article.id, 'deepdive');

    try {
      const qs = await invoke<string[]>('get_deepdive_questions', {
        articleId: article.id,
      });
      setQuestions(qs);
    } catch (_) {
      setQuestions(['この記事の詳細は？', '関連作品は？', '今後の展開は？']);
    } finally {
      setQuestionsLoading(false);
    }
  }, [article.id, state, recordInteraction]);

  const handleMarkRead = useCallback((): void => {
    markRead(article.id);
  }, [article.id, markRead]);

  const catLabel = article.category
    ? (CATEGORY_LABELS[article.category] ?? article.category)
    : null;

  const readTime = estimateReadTime(article.summary);

  return (
    <div
      ref={cardRef}
      className={`discover-card ${featured ? 'featured' : ''} ${article.isRead ? 'opacity-50' : ''}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a, .deepdive-panel')) return;
        handleOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !(e.target as HTMLElement).closest('button, a, .deepdive-panel'))
          handleOpen();
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* Meta line: source · time · category */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-0 text-xs" style={{ color: 'var(--text-source)' }}>
          <span className="font-medium">{article.feedName ?? 'Unknown'}</span>
          <span className="meta-dot">{formatRelativeTime(article.publishedAt)}</span>
          {catLabel && <span className="source-badge cat-badge ml-2">{catLabel}</span>}
          {readTime && <span className="meta-dot">{readTime}</span>}
        </div>

        <button
          type="button"
          onClick={handleBookmark}
          className="bookmark-btn"
          title="ブックマーク"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            fill={article.isBookmarked ? 'var(--accent)' : 'none'}
            stroke={article.isBookmarked ? 'var(--accent)' : 'var(--text-tertiary)'}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
        </button>
      </div>

      {/* Thumbnail */}
      {article.thumbnailUrl && (
        <div className={`card-thumbnail-wrap ${featured ? 'featured' : ''}`}>
          <img
            src={article.thumbnailUrl}
            alt=""
            loading="lazy"
            className="card-thumbnail"
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Title */}
      <button type="button" className="card-title" onClick={handleOpen}>
        {article.title}
      </button>

      {/* AI Summary */}
      {summaryLoading && <SummarySkeleton />}
      {summary && !summaryLoading && (
        <div className="ai-summary">
          <div className="ai-summary-label">
            <svg aria-hidden="true" className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            AI Summary
          </div>
          {stripCitations(summary)}
        </div>
      )}
      {!summary && !summaryLoading && article.summary && (
        <p
          className="text-sm mt-2 line-clamp-2"
          style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}
        >
          {stripCitations(article.summary)}
        </p>
      )}

      {/* Actions */}
      {state !== 'collapsed' && (
        <div className="flex items-center gap-2 mt-3">
          {(state === 'summary' || state === 'deepdive') && (
            <button type="button" onClick={handleDeepDive} className="card-action-btn primary">
              <svg
                aria-hidden="true"
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {state === 'deepdive' ? '閉じる' : 'もっと詳しく'}
            </button>
          )}

          <button
            type="button"
            onClick={handleOpen}
            disabled={!article.url}
            className="card-action-btn secondary"
            style={!article.url ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
          >
            <svg
              aria-hidden="true"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            開く
          </button>

          <button
            type="button"
            onClick={handleMarkRead}
            disabled={article.isRead}
            className="card-action-btn secondary"
            style={article.isRead ? { opacity: 0.3 } : undefined}
          >
            {article.isRead ? '既読済' : '既読'}
          </button>
        </div>
      )}

      {/* DeepDive Panel */}
      {state === 'deepdive' && (
        <>
          {questionsLoading && <SummarySkeleton />}
          {!questionsLoading && questions.length > 0 && (
            <DeepDivePanel
              articleId={article.id}
              questions={questions}
              onNewQuestions={setQuestions}
            />
          )}
        </>
      )}
    </div>
  );
};

export const DiscoverCard = React.memo(
  DiscoverCardInner,
  (prev, next) =>
    prev.article.id === next.article.id &&
    prev.article.isRead === next.article.isRead &&
    prev.article.isBookmarked === next.article.isBookmarked &&
    prev.article.aiSummary === next.article.aiSummary &&
    prev.featured === next.featured,
);
