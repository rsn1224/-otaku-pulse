import type React from 'react';

interface ToggleGroupProps {
  items: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
  accent?: boolean;
}

export const ToggleGroup: React.FC<ToggleGroupProps> = ({ items, active, onSelect, accent }) => (
  <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
    {items.map((item) => (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelect(item.id)}
        className="px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors"
        style={{
          background:
            active === item.id
              ? accent
                ? 'var(--accent)'
                : 'var(--bg-card-hover)'
              : 'transparent',
          color:
            active === item.id
              ? accent
                ? '#0e0e13'
                : 'var(--text-primary)'
              : 'var(--text-tertiary)',
        }}
      >
        {item.label}
      </button>
    ))}
  </div>
);
