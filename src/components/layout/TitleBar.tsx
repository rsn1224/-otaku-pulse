import { getCurrentWindow } from '@tauri-apps/api/window';
import type React from 'react';
import { useState } from 'react';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = async () => {
    const window = getCurrentWindow();
    await window.minimize();
  };

  const handleMaximize = async () => {
    const window = getCurrentWindow();
    if (isMaximized) {
      await window.unmaximize();
      setIsMaximized(false);
    } else {
      await window.maximize();
      setIsMaximized(true);
    }
  };

  const handleClose = async () => {
    const window = getCurrentWindow();
    await window.close();
  };

  return (
    <div
      className="flex items-center justify-between h-8 bg-gray-900 dark:bg-gray-800 text-white px-4"
      data-tauri-drag-region
    >
      <div className="flex items-center space-x-2" data-tauri-drag-region>
        <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
        <span className="text-sm font-medium" data-tauri-drag-region>
          OtakuPulse
        </span>
      </div>

      <div className="flex items-center space-x-1">
        <button
          type="button"
          onClick={handleMinimize}
          title="最小化"
          className="w-8 h-6 flex items-center justify-center hover:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleMaximize}
          title={isMaximized ? '元に戻す' : '最大化'}
          className="w-8 h-6 flex items-center justify-center hover:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
        >
          {isMaximized ? (
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4h16v16H4z"
              />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          title="閉じる"
          className="w-8 h-6 flex items-center justify-center hover:bg-red-600 rounded transition-colors"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
