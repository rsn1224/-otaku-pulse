import { AnimatePresence, motion } from 'motion/react';
import type React from 'react';
import { useCallback, useEffect, useId, useRef } from 'react';
import { useFocusReturn } from '../../hooks/useFocusReturn';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useScrollLock } from '../../hooks/useScrollLock';
import { modalContent, modalOverlay } from '../../lib/motion-variants';

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

export function Modal({
  isOpen,
  onClose,
  title,
  width = 'md',
  children,
}: ModalProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(contentRef, isOpen);
  useFocusReturn(isOpen);
  useScrollLock(isOpen);

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-overlay"
          variants={modalOverlay}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={handleOverlayClick}
          role="presentation"
        >
          <motion.div
            ref={contentRef}
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : 'ダイアログ'}
            className={`w-full ${WIDTH_CLASSES[width]} rounded-xl border border-(--outline-variant) bg-(--surface) overflow-hidden`}
          >
            {title && (
              <div className="px-6 py-4 border-b border-(--surface-container-highest)">
                <h2 id={titleId} className="text-lg font-bold tracking-tight text-(--on-surface)">
                  {title}
                </h2>
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
