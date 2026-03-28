import type React from 'react';
import { Spinner } from './Spinner';

const VARIANT_CLASSES = {
  primary: 'bg-(--primary) text-white hover:brightness-110',
  secondary:
    'bg-transparent text-(--on-surface-variant) hover:bg-white/[0.06] hover:text-(--on-surface)',
  ghost: 'bg-transparent text-(--on-surface-variant) hover:text-(--on-surface)',
  danger: 'bg-(--error) text-white hover:brightness-110',
} as const;

const SIZE_CLASSES = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3.5 py-1.5 text-[0.8125rem] gap-1.5',
  lg: 'px-5 py-2.5 text-sm gap-2',
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...rest
}) => {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={[
        'inline-flex items-center justify-center rounded-lg font-medium',
        'transition-all duration-150 active:scale-95',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary) focus-visible:ring-offset-1 focus-visible:ring-offset-(--surface)',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {isLoading ? <Spinner size="sm" /> : children}
    </button>
  );
};
