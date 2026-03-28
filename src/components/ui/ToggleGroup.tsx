import type React from 'react';
import { Badge } from './Badge';

interface ToggleItem<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

interface ToggleGroupProps<T extends string> {
  items: ToggleItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function ToggleGroup<T extends string>({
  items,
  value,
  onChange,
  className = '',
}: ToggleGroupProps<T>): React.ReactElement {
  return (
    <div className={`flex gap-2 ${className}`} role="tablist">
      {items.map((item) => {
        const isActive = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={[
              'px-4 py-1.5 rounded-full text-[0.8125rem] font-medium',
              'whitespace-nowrap border-none transition-all duration-200',
              'tracking-[0.01em] cursor-pointer',
              isActive
                ? 'bg-(--primary-soft) text-(--primary) font-semibold border-b-2 border-b-(--primary)'
                : 'bg-transparent text-(--on-surface-variant) hover:text-(--on-surface) hover:bg-white/[0.04]',
            ].join(' ')}
          >
            {item.label}
            {item.badge != null && item.badge > 0 && (
              <Badge variant="count" className="ml-2">
                {item.badge}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
