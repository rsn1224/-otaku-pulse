import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center rounded-lg font-medium',
    'transition-all duration-150 transition-transform active:scale-95',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary) focus-visible:ring-offset-1 focus-visible:ring-offset-(--surface)',
    'disabled:opacity-50 disabled:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-(--primary) text-white hover:brightness-110 hover:-translate-y-px',
        secondary:
          'bg-transparent text-(--on-surface-variant) hover:bg-white/[0.06] hover:text-(--on-surface)',
        ghost: 'bg-transparent text-(--on-surface-variant) hover:text-(--on-surface)',
        danger: 'bg-(--error) text-white hover:brightness-110',
        neon: 'border border-(--primary) bg-(--primary-glow) text-(--primary) hover:shadow-[0_0_16px_var(--glow-primary)] hover:-translate-y-px',
        glass:
          'bg-(--surface-glass) border border-white/15 text-(--on-surface) backdrop-blur-[20px]',
      },
      size: {
        sm: 'px-2 py-1 text-xs gap-1',
        md: 'px-3.5 py-1.5 text-[0.8125rem] gap-1.5',
        lg: 'px-5 py-2.5 text-sm gap-2',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export function Button({
  variant,
  size,
  isLoading = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    >
      {isLoading ? <Spinner size="sm" /> : children}
    </button>
  );
}
