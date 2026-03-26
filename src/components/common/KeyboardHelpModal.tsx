import type React from 'react';
import { useDiscoverStore } from '../../stores/useDiscoverStore';

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
  <kbd
    className="min-w-[28px] h-7 px-2 flex items-center justify-center font-mono text-xs rounded"
    style={{
      background: '#25252d',
      color: '#f9f5fd',
      border: '1px solid #48474d',
      boxShadow: '0 2px 0 0 #48474d',
    }}
  >
    {children}
  </kbd>
);

export const KeyboardHelpModal: React.FC = () => {
  const { showHelp, toggleHelp } = useDiscoverStore();

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-2xl rounded-xl overflow-hidden"
        style={{ background: '#12121a', border: '1px solid #1e1e2e' }}
      >
        <div
          className="px-8 py-5 flex items-center justify-between"
          style={{ borderBottom: '1px solid #1e1e2e' }}
        >
          <h2 className="text-xl font-bold tracking-tight" style={{ color: '#f1f5f9' }}>
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={toggleHelp}
            className="text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-lg"
            style={{ color: '#76747b', background: '#25252d' }}
          >
            Esc to close
          </button>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-2 gap-x-12 gap-y-5">
            <div className="space-y-4">
              <h3
                className="text-[11px] font-bold uppercase tracking-widest mb-2"
                style={{ color: 'rgba(189, 157, 255, 0.7)' }}
              >
                Navigation
              </h3>
              {NAV_SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#f1f5f9' }}>
                    {s.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <KeyBadge>{s.key}</KeyBadge>
                    {s.combo && (
                      <>
                        <span className="text-xs" style={{ color: '#76747b' }}>
                          +
                        </span>
                        <KeyBadge>{s.combo}</KeyBadge>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <h3
                className="text-[11px] font-bold uppercase tracking-widest mb-2"
                style={{ color: 'rgba(105, 156, 255, 0.7)' }}
              >
                Actions
              </h3>
              {ACTION_SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#f1f5f9' }}>
                    {s.label}
                  </span>
                  <KeyBadge>{s.key}</KeyBadge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="px-8 py-4 flex justify-center"
          style={{ background: 'rgba(19, 19, 25, 0.5)', borderTop: '1px solid #1e1e2e' }}
        >
          <span
            className="text-[11px] font-medium uppercase tracking-widest"
            style={{ color: '#48474d' }}
          >
            Press any key to close
          </span>
        </div>
      </div>
    </div>
  );
};
