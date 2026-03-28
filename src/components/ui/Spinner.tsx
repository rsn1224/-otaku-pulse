import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from '../../lib/utils';

export const spinnerVariants = cva(
  'rounded-full animate-spin border-(--outline-variant) border-t-(--primary)',
  {
    variants: {
      size: {
        sm: 'w-4 h-4 border',
        md: 'w-6 h-6 border-2',
        lg: 'w-8 h-8 border-2',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {}

export function Spinner({ size }: SpinnerProps): React.JSX.Element {
  return <div className={cn(spinnerVariants({ size }))} role="status" aria-label="Loading" />;
}
