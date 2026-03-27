import { invoke } from '@tauri-apps/api/core';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDeepDive } from '../../hooks/useDeepDive';
import { logger } from '../../lib/logger';
import { useArticleStore } from '../../stores/useArticleStore';
import { useReaderStore } from '../../stores/useReaderStore';
import type { DiscoverArticleDto } from '../../types';
import { CardActions } from './CardActions';
import { CardHeader } from './CardHeader';
import { CardSummary } from './CardSummary';
import { DeepDivePanel } from './DeepDivePanel';
import { SummarySkeleton } from './SummarySkeleton';

export type CardState = 'collapsed' | 'summary' | 'deepdive';

interface DiscoverCardProps {
  article: DiscoverArticleDto;
  featured?: boolean;
  isFocused?: boolean;
}

const DiscoverCardInner: React.FC<DiscoverCardProps> = ({
  article,
  featured = false,
  isFocused = false,
}) => {
  const [state, setState] = useState<CardState>('collapsed');
  const [summary, setSummary] = useState<string | null>(article.aiSummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryAttempted, setSummaryAttempted] = useState(!!article.aiSummary);
  const cardRef = useRef<HTMLDivElement>(null);
  const dwellStart = useRef<number>(0);

  const markRead = useArticleStore((s) => s.markRead);
  const toggleBookmark = useArticleStore((s) => s.toggleBookmark);
  const recordInteraction = useArticleStore((s) => s.recordInteraction);
  const updateArticleSummary = useArticleStore((s) => s.updateArticleSummary);
  const openReader = useReaderStore((s) => s.openReader);

  const { questions, questionsLoading, handleDeepDive, setQuestions } = useDeepDive(
    article.id,
    state,
    setState,
    recordInteraction,
  );

  useEffect(() => {
    if (summary || summaryAttempted) setState('summary');

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry!.isIntersecting) {
          if (dwellStart.current === 0) dwellStart.current = Date.now();
          if (!summary && !summaryLoading && !summaryAttempted) {
            setSummaryLoading(true);
            setSummaryAttempted(true);
            invoke<string>('get_or_generate_summary', { articleId: article.id })
              .then((s) => {
                setSummary(s);
                updateArticleSummary(article.id, s);
                setState('summary');
              })
              .catch((e) => {
                logger.warn({ error: e }, 'getOrGenerateSummary failed');
                setState('summary');
              })
              .finally(() => setSummaryLoading(false));
          }
        } else if (dwellStart.current > 0) {
          const seconds = Math.floor((Date.now() - dwellStart.current) / 1000);
          if (seconds >= 2) recordInteraction(article.id, 'view', seconds);
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

  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused]);

  const handleOpen = useCallback(() => {
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

  const handleMarkRead = useCallback(() => {
    markRead(article.id);
  }, [article.id, markRead]);

  return (
    <div
      ref={cardRef}
      role="article"
      className={`discover-card cursor-pointer ${featured ? 'featured' : ''} ${article.isRead ? 'opacity-50' : ''} ${isFocused ? 'ring-2 ring-blue-500' : ''}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a, .deepdive-panel')) return;
        handleOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !(e.target as HTMLElement).closest('button, a, .deepdive-panel'))
          handleOpen();
      }}
    >
      <CardHeader article={article} onBookmark={handleBookmark} />

      {article.thumbnailUrl && (
        <div className={`card-thumbnail-wrap ${featured ? 'featured' : ''}`}>
          <img
            src={article.thumbnailUrl}
            alt={article.title}
            loading="lazy"
            className="card-thumbnail"
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <button type="button" className="card-title" onClick={handleOpen}>
        {article.title}
      </button>

      <CardSummary
        summary={summary}
        summaryLoading={summaryLoading}
        fallbackSummary={article.summary}
      />

      <CardActions
        state={state}
        isRead={article.isRead}
        hasUrl={!!article.url}
        onDeepDive={handleDeepDive}
        onOpen={handleOpen}
        onMarkRead={handleMarkRead}
      />

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
    prev.featured === next.featured &&
    prev.isFocused === next.isFocused,
);
