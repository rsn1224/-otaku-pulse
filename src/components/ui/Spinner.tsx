import type React from 'react';

const SIZE_MAP = {
  sm: 'w-4 h-4 border',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZE_MAP;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
  return (
    <div
      className={`${SIZE_MAP[size]} rounded-full animate-spin border-[var(--outline-variant)] border-t-[var(--primary)]`}
      role="status"
      aria-label="Loading"
    />
  );
};
