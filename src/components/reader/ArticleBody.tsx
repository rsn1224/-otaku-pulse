import type React from 'react';
import { containsHtml, sanitizeHtml, stripCitations } from '../../lib/textUtils';
import type { ArticleDetailDto, DiscoverArticleDto } from '../../types';
import { RelatedArticles } from '../common/RelatedArticles';

interface ArticleBodyProps {
  article: ArticleDetailDto;
  related: DiscoverArticleDto[];
  relatedLoading: boolean;
}

export const ArticleBody: React.FC<ArticleBodyProps> = ({ article, related, relatedLoading }) => {
  return (
    <div className="flex-1 overflow-y-auto discover-scroll px-6 py-6">
      <div className="max-w-[640px] mx-auto">
        {article.summary && (
          <div className="glass-summary rounded-2xl p-5 mb-6 relative overflow-hidden">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-(--primary) bg-[rgba(189,157,255,0.1)] border border-[rgba(189,157,255,0.2)]">
                AI Summary
              </span>
            </div>
            <p className="text-[14px] leading-[1.6] italic text-[rgba(249,245,253,0.9)]">
              {stripCitations(article.summary)}
            </p>
          </div>
        )}

        {article.content ? (
          containsHtml(article.content) ? (
            <div
              className="text-sm leading-[1.85] article-html-content text-(--on-surface)"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
            />
          ) : (
            <div className="text-sm leading-[1.85] whitespace-pre-wrap text-(--on-surface)">
              {stripCitations(article.content)}
            </div>
          )
        ) : article.summary ? (
          <p className="text-sm leading-[1.85] text-(--on-surface)">
            {stripCitations(article.summary)}
          </p>
        ) : (
          <p className="text-sm italic text-(--outline)">
            記事内容がありません。元記事をブラウザで開いてください。
          </p>
        )}

        <RelatedArticles articles={related} isLoading={relatedLoading} />
      </div>
    </div>
  );
};
