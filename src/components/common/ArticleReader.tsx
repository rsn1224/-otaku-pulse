import { invoke } from '@tauri-apps/api/core';
import { motion } from 'motion/react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useMotionConfig } from '../../hooks/useMotionConfig';
import { logger } from '../../lib/logger';
import { useReaderStore } from '../../stores/useReaderStore';
import type { ArticleDetailDto, DiscoverArticleDto } from '../../types';
import { ArticleBody } from '../reader/ArticleBody';
import { ReaderHeader } from '../reader/ReaderHeader';

interface ArticleReaderProps {
  article: ArticleDetailDto;
  onClose: () => void;
}

export function ArticleReader({ article, onClose }: ArticleReaderProps): React.JSX.Element {
  const [related, setRelated] = useState<DiscoverArticleDto[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const { openNextArticle, openPrevArticle } = useReaderStore();
  const { variants } = useMotionConfig();

  const handleClose = useCallback((): void => {
    onClose();
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
    let stale = false;
    setRelated([]);
    setRelatedLoading(true);
    invoke<DiscoverArticleDto[]>('get_related_articles', { articleId: article.id })
      .then((r) => {
        if (!stale) setRelated(r);
      })
      .catch((e) => {
        logger.warn({ error: e }, 'getRelatedArticles failed');
        if (!stale) setRelated([]);
      })
      .finally(() => {
        if (!stale) setRelatedLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [article]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <motion.div
        variants={variants.modalOverlay}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/50"
        role="presentation"
        onClick={handleClose}
      />

      <motion.div
        variants={variants.slideInRight}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed right-0 top-0 h-full w-3/5 min-w-[480px] overflow-hidden flex flex-col bg-(--surface) border-l border-(--surface-container-highest)"
        style={{
          boxShadow: '-8px 0 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        <ReaderHeader article={article} onClose={handleClose} />
        <ArticleBody article={article} related={related} relatedLoading={relatedLoading} />
      </motion.div>
    </div>
  );
}
