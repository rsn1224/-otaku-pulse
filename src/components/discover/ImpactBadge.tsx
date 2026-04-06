import type React from 'react';
import { IMPACT_LABEL, type ImpactLevel } from '../../types';

interface ImpactBadgeProps {
  level: ImpactLevel | null | undefined;
}

/**
 * Displays a coloured badge for article impact level.
 * 'general' renders nothing — it would add noise to most articles.
 */
export function ImpactBadge({ level }: ImpactBadgeProps): React.JSX.Element | null {
  if (!level || level === 'general') return null;

  const label = IMPACT_LABEL[level];
  const colorClass =
    level === 'confirmed'
      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${colorClass}`}
      role="img"
      aria-label={label}
    >
      {label}
    </span>
  );
}
