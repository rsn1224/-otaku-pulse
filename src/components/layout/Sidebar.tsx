import type React from 'react';
import { useEffect } from 'react';
import { useFeedStore } from '../../stores/feedStore';

interface SidebarProps {
  activeWing: string;
  onWingChange: (wing: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeWing, onWingChange }) => {
  const { unreadCount, fetchUnreadCount } = useFeedStore();

  // 未読カウントを定期更新
  useEffect(() => {
    fetchUnreadCount();
    // 30秒ごとに更新
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const wings = [
    { id: 'dashboard', name: 'ダッシュボード', icon: '🏠' },
    { id: 'news', name: 'NEWS', icon: '📰', showBadge: true },
    { id: 'digest', name: 'DIGEST', icon: '📝' },
    { id: 'saved', name: 'SAVED', icon: '🔖' },
    { id: 'schedule', name: 'SCHEDULE', icon: '📺' },
    { id: 'settings', name: 'SETTINGS', icon: '⚙️' },
  ];

  return (
    <div className="w-64 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white h-full flex flex-col">
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">OtakuPulse</h2>
        <nav className="space-y-2">
          {wings.map((wing) => (
            <button
              type="button"
              key={wing.id}
              onClick={() => onWingChange(wing.id)}
              className={`w-full text-left px-4 py-2 rounded-lg transition-colors flex items-center space-x-3 ${
                activeWing === wing.id
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-xl">{wing.icon}</span>
              <span className="flex-1">{wing.name}</span>
              {wing.showBadge && unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};
