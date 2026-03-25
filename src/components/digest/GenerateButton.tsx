import type React from 'react';

interface GenerateButtonProps {
  category: string;
  isGenerating: boolean;
  onGenerate: () => void;
}

export const GenerateButton: React.FC<GenerateButtonProps> = ({
  category,
  isGenerating,
  onGenerate,
}) => {
  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={isGenerating}
      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
    >
      {isGenerating ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>生成中...</span>
        </>
      ) : (
        <span>{category}</span>
      )}
    </button>
  );
};
