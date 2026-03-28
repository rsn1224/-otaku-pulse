import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type React from 'react';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { toastSlideIn } from '../../lib/motion-variants';
import { cn } from '../../lib/utils';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: 'success' | 'error' | 'info', message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

const MAX_TOASTS = 5;

export function ToastProvider({ children }: ToastProviderProps): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (
    type: 'success' | 'error' | 'info',
    message: string,
    duration = 3000,
  ): void => {
    const id = Date.now().toString();
    const newToast: Toast = { id, type, message, duration };

    setToasts((prev) => {
      const next = [...prev, newToast];
      return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, duration);
  };

  const removeToast = (id: string): void => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps): React.JSX.Element {
  return (
    <section className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </section>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const TOAST_STYLES: Record<string, string> = {
  success: 'border-l-2 border-l-(--accent-game)',
  error: 'border-l-2 border-l-(--error)',
  info: 'border-l-2 border-l-(--secondary)',
};

const TOAST_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  success: CheckCircle,
  error: AlertTriangle,
  info: Info,
};

function ToastItem({ toast, onRemove }: ToastItemProps): React.JSX.Element {
  const IconComponent = TOAST_ICONS[toast.type] ?? Info;
  return (
    <motion.div
      layout
      variants={toastSlideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        'bold-glass rounded-[0.875rem] shadow-(--shadow-lg) px-4 py-3 max-w-sm',
        TOAST_STYLES[toast.type],
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconComponent
            size={16}
            className="text-(--on-surface-variant) shrink-0"
            aria-hidden="true"
          />
          <span className="text-[0.8125rem] font-medium text-(--on-surface)">{toast.message}</span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(toast.id)}
          className="ml-4 text-(--on-surface-variant) hover:text-(--on-surface) transition-colors"
          aria-label="通知を閉じる"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}
