import type React from 'react';
import { GenerateButton } from './GenerateButton';

interface DigestCardProps {
  category: string;
  summary: string;
  articleCount: number;
  generatedAt: string;
  onGenerate: () => void;
  isGenerating: boolean;
  error?: string | null;
  isAiGenerated?: boolean;
  provider?: string | null;
  fallbackReason?: string | null;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'anime':
      return '🎌';
    case 'game':
      return '🎮';
    case 'manga':
      return '📖';
    case 'pc':
      return '💻';
    default:
      return '📰';
  }
};

const getCategoryName = (category: string) => {
  switch (category) {
    case 'anime':
      return 'アニメ';
    case 'game':
      return 'ゲーム';
    case 'manga':
      return '漫画';
    case 'pc':
      return 'ハードウェア';
    default:
      return 'すべて';
  }
};

export const DigestCard: React.FC<DigestCardProps> = ({
  category,
  summary,
  articleCount,
  generatedAt,
  onGenerate,
  isGenerating,
  error,
  isAiGenerated,
  provider,
  fallbackReason,
}) => {
  const formattedTime = new Date(generatedAt).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const hasContent = summary && summary.trim() !== '';

  // プロバイダーバッジ
  const getProviderBadge = () => {
    if (!isAiGenerated || !provider) return null;

    switch (provider) {
      case 'PerplexitySonar':
        return (
          <span className="px-2 py-1 text-xs bg-blue-500 text-white rounded">[Perplexity]</span>
        );
      case 'Ollama':
        return <span className="px-2 py-1 text-xs bg-green-500 text-white rounded">[Ollama]</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{getCategoryIcon(category)}</span>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {getCategoryName(category)}
          </h3>
          {hasContent && isAiGenerated && getProviderBadge()}
          {hasContent && !isAiGenerated && (
            <span className="px-2 py-1 text-xs bg-gray-600 text-white rounded">[スタブ]</span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {hasContent && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{formattedTime}更新</span>
          )}
          <GenerateButton
            category={getCategoryName(category)}
            isGenerating={isGenerating}
            onGenerate={onGenerate}
          />
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-3"></div>

      {error && <div className="text-red-500 dark:text-red-400 text-sm mb-3">エラー: {error}</div>}

      {fallbackReason && (
        <div className="text-yellow-600 dark:text-yellow-400 text-sm mb-3">⚠️ {fallbackReason}</div>
      )}

      {hasContent ? (
        <>
          <div className="text-gray-700 dark:text-gray-300 text-[15px] mb-3 space-y-2">
            {summary.split('\n').map((line, i) => (
              <p key={`line-${i}`} className={line.startsWith('•') ? 'pl-2' : 'font-semibold'}>
                {line}
              </p>
            ))}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            記事{articleCount}件より生成
          </div>
        </>
      ) : (
        <div className="text-gray-500 dark:text-gray-400 text-center py-4">
          （生成ボタンを押してください）
        </div>
      )}
    </div>
  );
};
