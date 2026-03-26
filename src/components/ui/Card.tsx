import type React from 'react';

interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  isInteractive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  onClick,
  className = '',
  isInteractive = false,
}) => {
  const interactive = isInteractive || !!onClick;

  return (
    <div
      className={[
        'relative rounded-[0.875rem] border border-[var(--surface-container-highest)]',
        'bg-[var(--surface-container)] p-6 mb-4',
        'transition-all duration-200',
        interactive
          ? 'cursor-pointer hover:bg-[var(--surface-container-high)] hover:border-[var(--outline-variant)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 hover:scale-[1.01]'
          : '',
        className,
      ].join(' ')}
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
};
