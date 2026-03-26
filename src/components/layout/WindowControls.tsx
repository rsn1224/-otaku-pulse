import type React from 'react';

export const WindowControls: React.FC = () => {
  const handleAction = async (action: 'minimize' | 'maximize' | 'close'): Promise<void> => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    if (action === 'minimize') await win.minimize();
    else if (action === 'maximize') {
      if (await win.isMaximized()) await win.unmaximize();
      else await win.maximize();
    } else await win.close();
  };
  return (
    <div className="flex items-center gap-1">
      {(['minimize', 'maximize', 'close'] as const).map((action) => (
        <button
          key={action}
          type="button"
          onClick={() => handleAction(action)}
          title={action === 'minimize' ? '最小化' : action === 'maximize' ? '最大化' : '閉じる'}
          className={`w-7 h-5 flex items-center justify-center rounded transition-colors ${action === 'close' ? 'hover:bg-red-600' : 'hover:bg-white/10'}`}
        >
          <svg
            aria-hidden="true"
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={
                action === 'minimize'
                  ? 'M20 12H4'
                  : action === 'maximize'
                    ? 'M4 4h16v16H4z'
                    : 'M6 18L18 6M6 6l12 12'
              }
            />
          </svg>
        </button>
      ))}
    </div>
  );
};
