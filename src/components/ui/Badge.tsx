import type React from 'react';

const VARIANT_CLASSES = {
  default: 'bg-white/[0.04] text-(--on-surface-variant) border-(--surface-container-highest)',
  category: 'bg-(--primary-glow) text-(--primary) border-[rgba(29,185,160,0.15)]',
  hot: 'bg-(--error)/10 text-(--error) border-(--error)/20',
  new: 'bg-(--secondary)/10 text-(--secondary) border-(--secondary)/20',
  count: 'bg-(--primary) text-white border-transparent',
} as const;

interface BadgeProps {
  variant?: keyof typeof VARIANT_CLASSES;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => {
  const isCount = variant === 'count';

  return (
    <span
      className={[
        'inline-flex items-center gap-1 border rounded-full font-medium tracking-wide',
        isCount ? 'px-1.5 text-[0.625rem] min-w-[1.125rem] h-[1.125rem] justify-center' : '',
        !isCount ? 'px-2.5 py-0.5 text-[0.6875rem]' : '',
        VARIANT_CLASSES[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
};
