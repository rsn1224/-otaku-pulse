import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Inbox, Search as SearchIcon, Star } from 'lucide-react';
import type React from 'react';
import { cn } from '../../lib/utils';

type EmptyVariant = 'no-articles' | 'no-saved' | 'no-results' | 'no-schedule';

const VARIANT_CONFIG: Record<
  EmptyVariant,
  {
    Icon: LucideIcon;
    motifClass: string;
    heading: string;
    body: string;
  }
> = {
  'no-articles': {
    Icon: Inbox,
    motifClass: 'empty-speedlines',
    heading: 'Nothing here yet',
    body: "Your feeds haven't delivered anything new. Try refreshing or adding more sources in Settings.",
  },
  'no-saved': {
    Icon: Star,
    motifClass: 'empty-stars',
    heading: 'No saved articles',
    body: 'Bookmark articles while reading to find them here.',
  },
  'no-results': {
    Icon: SearchIcon,
    motifClass: 'empty-sakura',
    heading: 'No matches found',
    body: 'Try a different search term or clear your filters.',
  },
  'no-schedule': {
    Icon: CalendarDays,
    motifClass: 'empty-dots',
    heading: 'No schedule items',
    body: 'Upcoming releases and airing times will appear here.',
  },
};

interface EmptyStateProps {
  variant: EmptyVariant;
  className?: string;
}

export function EmptyState({ variant, className }: EmptyStateProps): React.JSX.Element {
  const config = VARIANT_CONFIG[variant];
  const { Icon } = config;
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center py-16 px-8 text-center',
        'retro-decoration retro-corner-bracket retro-scanline',
        className,
      )}
    >
      {/* CSS motif background */}
      <div className={cn('absolute inset-0 pointer-events-none', config.motifClass)} />

      {/* Icon */}
      <Icon
        size={48}
        className="relative z-10 text-(--on-surface-variant) opacity-40 mb-4"
        aria-hidden="true"
      />

      {/* Copy */}
      <h3 className="relative z-10 text-[0.9375rem] font-semibold text-(--on-surface) mb-1">
        {config.heading}
      </h3>
      <p className="relative z-10 text-[0.8125rem] text-(--on-surface-variant) max-w-xs leading-normal">
        {config.body}
      </p>
    </div>
  );
}
