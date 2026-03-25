import type React from 'react';
import { useArticleStore } from '../../stores/useArticleStore';

interface CategoryTabsProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

const categories = [
  { id: null, name: 'すべて' },
  { id: 'anime', name: 'アニメ' },
  { id: 'manga', name: '漫画' },
  { id: 'game', name: 'ゲーム' },
  { id: 'pc', name: 'ハードウェア' },
];

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  selectedCategory,
  onCategoryChange,
}) => {
  const { articles } = useArticleStore();

  // 各カテゴリの未読数を計算
  const getUnreadCount = (categoryId: string | null) => {
    return articles.filter(
      (article) =>
        article.is_read === false && (categoryId === null || article.category === categoryId),
    ).length;
  };

  return (
    <div className="flex space-x-2 mb-4">
      {categories.map((category) => {
        const unreadCount = getUnreadCount(category.id);

        return (
          <button
            type="button"
            key={category.id || 'all'}
            onClick={() => onCategoryChange(category.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors relative ${
              selectedCategory === category.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {category.name}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-2 py-1 text-xs bg-red-600 text-white rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
