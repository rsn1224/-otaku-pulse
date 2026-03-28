import type React from 'react';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, className = '', id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-(--on-surface-variant)">
            {label}
          </label>
        )}
        <div
          className={[
            'flex items-center gap-2 px-3 py-2 rounded-lg',
            'bg-white/[0.04] border border-(--surface-container-highest)',
            'transition-all duration-200',
            'focus-within:border-(--primary) focus-within:shadow-[0_0_0_2px_var(--primary-soft)]',
            error ? 'border-(--error)' : '',
            className,
          ].join(' ')}
        >
          {leftIcon && <span className="text-(--outline) flex-shrink-0">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className="bg-transparent border-none outline-none text-(--on-surface) text-[0.8125rem] w-full placeholder:text-(--outline)"
            {...rest}
          />
        </div>
        {error && <span className="text-xs text-(--error)">{error}</span>}
      </div>
    );
  },
);

Input.displayName = 'Input';
