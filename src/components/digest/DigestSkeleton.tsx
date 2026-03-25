import type React from 'react';

interface DigestSkeletonProps {
  count?: number;
}

export const DigestSkeleton: React.FC<DigestSkeletonProps> = ({ count = 3 }) => {
  return (
    <div className="space-y-6">
      {[...Array(count)].map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="bg-gray-800 rounded-lg p-6 border border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-700 rounded w-1/3 animate-pulse"></div>
            <div className="h-4 bg-gray-700 rounded w-24 animate-pulse"></div>
          </div>

          <div className="mb-3">
            <div className="h-4 bg-gray-700 rounded w-20 animate-pulse"></div>
          </div>

          <div className="space-y-2">
            <div className="h-4 bg-gray-700 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-gray-700 rounded w-5/6 animate-pulse"></div>
            <div className="h-4 bg-gray-700 rounded w-4/5 animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  );
};
