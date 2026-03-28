import { Sparkles } from 'lucide-react';
import type React from 'react';
import { stripCitations } from '../../lib/textUtils';
import { Badge } from '../ui/Badge';
import { SummarySkeleton } from './SummarySkeleton';

interface CardSummaryProps {
  summary: string | null;
  summaryLoading: boolean;
  fallbackSummary: string | null | undefined;
}

export function CardSummary({
  summary,
  summaryLoading,
  fallbackSummary,
}: CardSummaryProps): React.JSX.Element | null {
  if (summaryLoading) return <SummarySkeleton />;

  if (summary) {
    return (
      <div className="ai-summary">
        <div className="ai-summary-label">
          <Badge variant="ai">
            <Sparkles size={10} aria-hidden="true" />
            AI
          </Badge>
          {' Summary'}
        </div>
        {stripCitations(summary)}
      </div>
    );
  }

  if (fallbackSummary) {
    return (
      <p className="text-sm mt-2 line-clamp-2 text-(--on-surface-variant) leading-[1.7]">
        {stripCitations(fallbackSummary)}
      </p>
    );
  }

  return null;
}
