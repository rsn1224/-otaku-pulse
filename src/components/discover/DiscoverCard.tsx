import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDeepDive } from '../../hooks/useDeepDive';
import { logger } from '../../lib/logger';
import { getOrGenerateSummary } from '../../lib/tauri-commands';
import { cn } from '../../lib/utils';
import { useArticleStore } from '../../stores/useArticleStore';
import { useReaderStore } from '../../stores/useReaderStore';
import type { DiscoverArticleDto } from '../../types';
import { CardActions } from './CardActions';
import { CardHeader } from './CardHeader';
import { CardSummary } from './CardSummary';
import { CoverArtFallback } from './CoverArtFallback';
import { DeepDivePanel } from './DeepDivePanel';
import { SummarySkeleton } from './SummarySkeleton';

export type CardState = 'collapsed' | 'summary' | 'deepdive';

type ContentType = 'anime' | 'manga' | 'game' | 'news';

interface DiscoverCardProps {
  article: DiscoverArticleDto;
  featured?: boolean;
  isFocused?: boolean;
}

function deriveContentType(article: DiscoverArticleDto): ContentType {
  const raw = article.category ?? '';
  if (raw === 'anime') return 'anime';
  if (raw === 'manga') return 'manga';
  if (raw === 'game' || raw === 'pc') return 'game';
  return 'news';
}

const DiscoverCardInner = ({
  article,
  featured = false,
  isFocused = false,
}: DiscoverCardProps): React.JSX.Element => {
  const [state, setState] = useState<CardState>('collapsed');
  const [summary, setSummary] = useState<string | null>(article.aiSummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryAttempted, setSummaryAttempted] = useState(!!article.aiSummary);
  const [bookmarkAnimClass, setBookmarkAnimClass] = useState('');
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
        if (entry?.isIntersecting) {
          if (dwellStart.current === 0) dwellStart.current = Date.now();
          if (!summary && !summaryLoading && !summaryAttempted) {
            setSummaryLoading(true);
            setSummaryAttempted(true);
            getOrGenerateSummary(article.id)
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
    const wasBookmarked = article.isBookmarked;
    toggleBookmark(article.id);
    recordInteraction(article.id, 'bookmark');
    setBookmarkAnimClass(wasBookmarked ? 'just-unbookmarked' : 'just-bookmarked');
    setTimeout(() => {
      bookmarkingRef.current = false;
      setBookmarkAnimClass('');
    }, 500);
  }, [article.id, article.isBookmarked, toggleBookmark, recordInteraction]);

  const handleMarkRead = useCallback(() => {
    markRead(article.id);
  }, [article.id, markRead]);

  const contentType = deriveContentType(article);
  const borderClass = `border-l-[3px] border-l-(--accent-${contentType})`;

  function renderThumbnail(isCompact: boolean): React.JSX.Element {
    const sizeClass = isCompact
      ? 'flex-shrink-0 w-14 rounded-lg overflow-hidden'
      : 'relative retro-scanline w-full mb-3 rounded-lg overflow-hidden';
    const aspectClass = isCompact ? 'aspect-[2/3]' : 'aspect-[2/3] max-h-[200px]';

    return (
      <div className={cn(sizeClass, aspectClass)}>
        {article.thumbnailUrl ? (
          <img
            src={article.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <CoverArtFallback contentType={contentType} />
        )}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      role="article"
      className={cn(
        'discover-card retro-corner-bracket cursor-pointer',
        borderClass,
        featured ? 'featured' : '',
        article.isRead ? 'opacity-50' : '',
        isFocused ? 'ring-2 ring-blue-500' : '',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a, .deepdive-panel')) return;
        handleOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !(e.target as HTMLElement).closest('button, a, .deepdive-panel'))
          handleOpen();
      }}
    >
      {state === 'collapsed' ? (
        <div className="flex gap-3">
          {renderThumbnail(true)}
          <div className="flex-1 min-w-0">
            <CardHeader
              article={article}
              onBookmark={handleBookmark}
              bookmarkAnimClass={bookmarkAnimClass}
            />
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
              articleId={article.id}
              onDeepDive={handleDeepDive}
              onOpen={handleOpen}
              onMarkRead={handleMarkRead}
            />
          </div>
        </div>
      ) : (
        <>
          {renderThumbnail(false)}
          <CardHeader article={article} onBookmark={handleBookmark} />
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
            articleId={article.id}
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
