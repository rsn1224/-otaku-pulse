import type React from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-(--on-surface-variant)">
            {label}
          </label>
        )}
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg',
            'bg-(--surface-container) border border-(--outline-variant)',
            'transition-all duration-200',
            'focus-within:border-(--primary) focus-within:shadow-(--focus-ring)',
            error ? 'border-(--error)' : '',
            className,
          )}
        >
          {leftIcon && <span className="text-(--outline) flex-shrink-0">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className="bg-transparent border-none outline-none text-(--on-surface) text-[0.8125rem] w-full placeholder:text-(--outline)"
            {...rest}
          />
        </div>
        {error && <span className="text-[0.6875rem] text-(--error)">{error}</span>}
      </div>
    );
  },
);

Input.displayName = 'Input';
