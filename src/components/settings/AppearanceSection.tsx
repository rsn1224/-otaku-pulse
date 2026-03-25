import type React from 'react';
import { type Theme, useThemeStore } from '../../stores/useThemeStore';

export const AppearanceSection: React.FC = () => {
  const { theme, setTheme } = useThemeStore();

  const themes: { value: Theme; label: string; description: string }[] = [
    {
      value: 'light',
      label: 'ライト',
      description: '常にライトテーマを使用',
    },
    {
      value: 'dark',
      label: 'ダーク',
      description: '常にダークテーマを使用',
    },
    {
      value: 'system',
      label: 'システム',
      description: 'OSのテーマ設定に従う',
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">外観</h3>

      <div className="space-y-3">
        {themes.map(({ value, label, description }) => (
          <label
            key={value}
            className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={theme === value}
              onChange={() => setTheme(value)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-gray-100">{label}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          💡 テーマは自動的に保存され、次回起動時に復元されます
        </p>
      </div>
    </div>
  );
};
