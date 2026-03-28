import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from '../../lib/utils';

export const cardVariants = cva(
  'relative rounded-[0.875rem] p-6 mb-4 transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-(--surface-container) border border-(--surface-container-highest)',
        glass: 'bold-glass shadow-(--shadow-md)',
        featured: 'bg-(--surface-container) border-l-4',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface CardProps extends VariantProps<typeof cardVariants> {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  isInteractive?: boolean;
}

export function Card({
  variant,
  children,
  onClick,
  className,
  isInteractive = false,
}: CardProps): React.JSX.Element {
  const interactive = isInteractive || !!onClick;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role is conditionally applied
    <div
      className={cn(
        cardVariants({ variant }),
        interactive
          ? 'cursor-pointer hover:bg-(--surface-container-high) hover:shadow-(--shadow-md) hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary)'
          : '',
        className,
      )}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick?.();
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
