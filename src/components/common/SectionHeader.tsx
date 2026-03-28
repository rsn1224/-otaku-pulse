import type React from 'react';
import { cn } from '../../lib/utils';

type ContentType = 'anime' | 'manga' | 'game' | 'news';

const ACCENT_BORDER: Record<ContentType | 'default', string> = {
  default: 'border-l-(--primary)',
  anime: 'border-l-(--accent-anime)',
  manga: 'border-l-(--accent-manga)',
  game: 'border-l-(--accent-game)',
  news: 'border-l-(--accent-news)',
};

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  contentType?: ContentType;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  contentType,
  className,
}: SectionHeaderProps): React.JSX.Element {
  const borderClass = ACCENT_BORDER[contentType ?? 'default'];
  return (
    <div
      className={cn(
        'relative retro-decoration border-l-4 pl-3 shadow-[-4px_0_12px_var(--glow-secondary)]',
        borderClass,
        className,
      )}
    >
      <h2 className="text-[1.125rem] font-semibold leading-[1.2] text-(--on-surface)">{title}</h2>
      {subtitle && (
        <p className="text-[0.6875rem] font-normal leading-[1.4] text-(--on-surface-variant) mt-0.5">
          {subtitle}
        </p>
      )}
    </div>
  );
}
