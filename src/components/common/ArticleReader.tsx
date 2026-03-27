import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useReaderStore } from '../../stores/useReaderStore';
import type { ArticleDetailDto, DiscoverArticleDto } from '../../types';
import { ArticleBody } from '../reader/ArticleBody';
import { ReaderHeader } from '../reader/ReaderHeader';

interface ArticleReaderProps {
  article: ArticleDetailDto | null;
  onClose: () => void;
}

export const ArticleReader: React.FC<ArticleReaderProps> = ({ article, onClose }) => {
  const [closing, setClosing] = useState(false);
  const [related, setRelated] = useState<DiscoverArticleDto[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const { openNextArticle, openPrevArticle } = useReaderStore();

  const handleClose = useCallback((): void => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight') openNextArticle();
      if (e.key === 'ArrowLeft') openPrevArticle();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleClose, openNextArticle, openPrevArticle]);

  useEffect(() => {
    if (!article) return;
    let stale = false;
    setRelated([]);
    setRelatedLoading(true);
    invoke<DiscoverArticleDto[]>('get_related_articles', { articleId: article.id })
      .then((r) => {
        if (!stale) setRelated(r);
      })
      .catch(() => {
        if (!stale) setRelated([]);
      })
      .finally(() => {
        if (!stale) setRelatedLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [article]);

  if (!article) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay click-to-close pattern */}
      <div
        className="fixed inset-0 bg-black/50"
        role="presentation"
        onClick={handleClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleClose();
        }}
      />

      <div
        className="fixed right-0 top-0 h-full w-3/5 min-w-[480px] overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-primary)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 40px rgba(0, 0, 0, 0.4)',
          animation: closing
            ? 'slideOutRight 0.2s ease-in forwards'
            : 'slideInRight 0.25s ease-out',
        }}
      >
        <ReaderHeader article={article} onClose={handleClose} />
        <ArticleBody article={article} related={related} relatedLoading={relatedLoading} />
      </div>
    </div>
  );
};
