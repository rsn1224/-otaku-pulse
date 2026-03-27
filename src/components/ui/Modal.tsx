import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';

const WIDTH_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: keyof typeof WIDTH_CLASSES;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, width = 'md', children }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: overlay click-to-close
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${WIDTH_CLASSES[width]} rounded-xl border border-[var(--outline-variant)] bg-[var(--surface)] overflow-hidden`}
      >
        {title && (
          <div className="px-6 py-4 border-b border-[var(--surface-container-highest)]">
            <h2 className="text-lg font-bold tracking-tight text-[var(--on-surface)]">{title}</h2>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
