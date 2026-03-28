import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from '../../lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 border rounded-full font-medium tracking-wide',
  {
    variants: {
      variant: {
        default:
          'px-2.5 py-0.5 text-[0.6875rem] bg-white/[0.04] text-(--on-surface-variant) border-(--surface-container-highest)',
        category:
          'px-2.5 py-0.5 text-[0.6875rem] bg-(--primary-glow) text-(--primary) border-[rgba(29,185,160,0.15)]',
        hot: 'px-2.5 py-0.5 text-[0.6875rem] bg-(--error)/10 text-(--error) border-(--error)/20',
        new: 'px-2.5 py-0.5 text-[0.6875rem] bg-(--secondary)/10 text-(--secondary) border-(--secondary)/20',
        count:
          'px-1.5 text-[0.625rem] min-w-[1.125rem] h-[1.125rem] justify-center bg-(--primary) text-white border-transparent',
        ai: 'px-2.5 py-0.5 text-[0.625rem] bg-linear-to-r from-(--accent-anime) to-(--secondary) text-white font-semibold',
        'content-anime':
          'px-2.5 py-0.5 text-[0.6875rem] border-(--accent-anime) bg-(--accent-anime)/10 text-(--accent-anime)',
        'content-manga':
          'px-2.5 py-0.5 text-[0.6875rem] border-(--accent-manga) bg-(--accent-manga)/10 text-(--accent-manga)',
        'content-game':
          'px-2.5 py-0.5 text-[0.6875rem] border-(--accent-game) bg-(--accent-game)/10 text-(--accent-game)',
        'content-news':
          'px-2.5 py-0.5 text-[0.6875rem] border-(--accent-news) bg-(--accent-news)/10 text-(--accent-news)',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className }: BadgeProps): React.JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}
