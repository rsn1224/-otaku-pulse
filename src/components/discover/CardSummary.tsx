import type React from 'react';
import { stripCitations } from '../../lib/textUtils';
import { SummarySkeleton } from './SummarySkeleton';

interface CardSummaryProps {
  summary: string | null;
  summaryLoading: boolean;
  fallbackSummary: string | null | undefined;
}

export const CardSummary: React.FC<CardSummaryProps> = ({
  summary,
  summaryLoading,
  fallbackSummary,
}) => {
  if (summaryLoading) return <SummarySkeleton />;

  if (summary) {
    return (
      <div className="ai-summary">
        <div className="ai-summary-label">
          <svg aria-hidden="true" className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          AI Summary
        </div>
        {stripCitations(summary)}
      </div>
    );
  }

  if (fallbackSummary) {
    return (
      <p className="text-sm mt-2 line-clamp-2 text-[var(--text-secondary)] leading-[1.7]">
        {stripCitations(fallbackSummary)}
      </p>
    );
  }

  return null;
};
