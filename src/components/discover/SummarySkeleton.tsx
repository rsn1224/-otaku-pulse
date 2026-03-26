import type React from 'react';

export const SummarySkeleton: React.FC = () => (
  <div className="ai-summary space-y-2">
    <div className="skeleton-line h-3 w-full" />
    <div className="skeleton-line h-3 w-4/5" />
    <div className="skeleton-line h-3 w-3/5" />
  </div>
);
