import type React from 'react';

export const CardSkeleton: React.FC = () => (
  <div className="discover-card opacity-60">
    <div className="flex items-center gap-2 mb-3">
      <div className="skeleton-line h-4 w-20" />
      <div className="skeleton-line h-4 w-12" />
    </div>
    <div className="skeleton-line h-32 w-full mb-3 rounded-lg" />
    <div className="skeleton-line h-5 w-4/5 mb-2" />
    <div className="skeleton-line h-5 w-3/5 mb-3" />
    <div className="skeleton-line h-3 w-full mb-1" />
    <div className="skeleton-line h-3 w-4/5 mb-1" />
    <div className="skeleton-line h-3 w-3/5" />
  </div>
);

export const CardSkeletonGrid: React.FC = () => (
  <div className="card-grid">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);
