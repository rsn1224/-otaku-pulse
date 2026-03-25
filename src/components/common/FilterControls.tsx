import type React from 'react';

interface FilterControlsProps {
  unreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
  onMarkAllRead: () => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  unreadOnly,
  onUnreadOnlyChange,
  onMarkAllRead,
}) => {
  return (
    <div className="flex items-center justify-between mb-4 p-3 bg-gray-800 rounded-lg">
      <div className="flex items-center space-x-4">
        <label className="flex items-center space-x-2 text-gray-300">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => onUnreadOnlyChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          />
          <span>未読のみ表示</span>
        </label>
      </div>

      <button
        type="button"
        onClick={onMarkAllRead}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        全件既読にする
      </button>
    </div>
  );
};
