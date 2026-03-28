import type React from 'react';
import { useEffect, useRef } from 'react';
import { useFocusReturn } from '../../hooks/useFocusReturn';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useKeyboardStore } from '../../stores/useKeyboardStore';

const NAV_SHORTCUTS: { key: string; label: string; combo?: string }[] = [
  { key: 'J', label: 'Next Article' },
  { key: 'K', label: 'Previous Article' },
  { key: '/', label: 'Global Search' },
  { key: 'G', label: 'Return Home', combo: 'H' },
];

const ACTION_SHORTCUTS: { key: string; label: string }[] = [
  { key: 'B', label: 'Save to Library' },
  { key: 'O', label: 'Open Article' },
  { key: 'M', label: 'Toggle Read' },
  { key: '?', label: 'Help Modal' },
];

const KeyBadge: React.FC<{ children: string }> = ({ children }) => (
  <kbd className="min-w-[28px] h-7 px-2 flex items-center justify-center font-mono text-xs rounded bg-[#25252d] text-[#f9f5fd] border border-[#48474d] shadow-[0_2px_0_0_#48474d]">
    {children}
  </kbd>
);

export const KeyboardHelpModal: React.FC = () => {
  const { showHelp, toggleHelp } = useKeyboardStore();
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, showHelp);
  useFocusReturn(showHelp);
  useScrollLock(showHelp);

  useEffect(() => {
    if (!showHelp) return;
    const close = (): void => toggleHelp();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [showHelp, toggleHelp]);

  if (!showHelp) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="キーボードショートカット"
        className="w-full max-w-2xl rounded-xl overflow-hidden bg-[#12121a] border border-[#1e1e2e]"
      >
        <div className="px-8 py-5 flex items-center justify-between border-b border-[#1e1e2e]">
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={toggleHelp}
            className="text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-lg text-[#76747b] bg-[#25252d]"
          >
            Esc to close
          </button>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-2 gap-x-12 gap-y-5">
            <div className="space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest mb-2 text-[rgba(189,157,255,0.7)]">
                Navigation
              </h3>
              {NAV_SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-100">{s.label}</span>
                  <div className="flex items-center gap-1">
                    <KeyBadge>{s.key}</KeyBadge>
                    {s.combo && (
                      <>
                        <span className="text-xs text-[#76747b]">+</span>
                        <KeyBadge>{s.combo}</KeyBadge>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest mb-2 text-[rgba(105,156,255,0.7)]">
                Actions
              </h3>
              {ACTION_SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-100">{s.label}</span>
                  <KeyBadge>{s.key}</KeyBadge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-8 py-4 flex justify-center bg-[rgba(19,19,25,0.5)] border-t border-[#1e1e2e]">
          <span className="text-[11px] font-medium uppercase tracking-widest text-[#48474d]">
            Press any key to close
          </span>
        </div>
      </div>
    </div>
  );
};
