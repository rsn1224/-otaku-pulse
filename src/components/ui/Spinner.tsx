import type React from 'react';

const SIZE_MAP = {
  sm: 'w-4 h-4 border',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZE_MAP;
}

export function Spinner({ size = 'md' }: SpinnerProps): React.JSX.Element {
  return (
    <div
      className={`${SIZE_MAP[size]} rounded-full animate-spin border-(--outline-variant) border-t-(--primary)`}
      role="status"
      aria-label="Loading"
    />
  );
}
