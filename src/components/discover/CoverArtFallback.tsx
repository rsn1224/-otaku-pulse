import type { LucideIcon } from 'lucide-react';
import { BookOpen, Gamepad2, Newspaper, Tv } from 'lucide-react';
import type React from 'react';
import { cn } from '../../lib/utils';

type ContentType = 'anime' | 'manga' | 'game' | 'news';

const FALLBACK_ICON: Record<ContentType, LucideIcon> = {
  anime: Tv,
  manga: BookOpen,
  game: Gamepad2,
  news: Newspaper,
};

interface CoverArtFallbackProps {
  contentType: ContentType;
  className?: string;
}

export function CoverArtFallback({
  contentType,
  className,
}: CoverArtFallbackProps): React.JSX.Element {
  const Icon = FALLBACK_ICON[contentType] ?? Tv;
  return (
    <div
      className={cn(
        'w-full h-full rounded-lg flex items-center justify-center',
        `bg-linear-to-br from-(--accent-${contentType}) to-(--surface-container-high)`,
        className,
      )}
    >
      <Icon size={32} className="text-(--on-surface-variant)" aria-hidden="true" />
    </div>
  );
}
