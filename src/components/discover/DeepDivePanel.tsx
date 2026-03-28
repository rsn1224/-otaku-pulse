import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useRef, useState } from 'react';
import { logger } from '../../lib/logger';
import { stripCitations } from '../../lib/textUtils';
import { cn } from '../../lib/utils';
import type { Citation, DeepDiveResult } from '../../types';
import { CitationFooter } from './CitationFooter';
import { SummarySkeleton } from './SummarySkeleton';

interface DeepDivePanelProps {
  articleId: number;
  questions: string[];
  onNewQuestions: (questions: string[]) => void;
}

export function DeepDivePanel({
  articleId,
  questions,
  onNewQuestions,
}: DeepDivePanelProps): React.JSX.Element {
  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customQ, setCustomQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAsk = async (q: string): Promise<void> => {
    if (isLoading || !q.trim()) return;
    setSelectedQ(q);
    setIsLoading(true);
    setAnswer(null);

    try {
      const result = await invoke<DeepDiveResult>('ask_deepdive', {
        articleId,
        question: q,
      });
      setAnswer(result.answer);
      setCitations(result.citations ?? []);
      if (result.followUpQuestions.length > 0) {
        onNewQuestions(result.followUpQuestions);
      }
    } catch (e) {
      logger.error({ error: e }, 'askDeepDive failed');
      setAnswer('回答の取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomSubmit = (): void => {
    const q = customQ.trim();
    if (q) {
      handleAsk(q);
      setCustomQ('');
    }
  };

  return (
    <div
      id={`deepdive-${articleId}`}
      className="bold-glass-sm rounded-[0.75rem] shadow-(--shadow-md) mt-4 p-4"
    >
      <p className="text-xs font-medium mb-2 text-(--on-surface-variant)">深堀りする</p>

      {/* 提案質問 */}
      <div className="flex flex-col gap-1">
        {questions.map((q, i) => (
          <button
            key={q}
            type="button"
            disabled={isLoading}
            onClick={() => handleAsk(q)}
            className={cn(
              'flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-lg text-[0.8125rem] text-(--on-surface-variant) bg-(--surface-container-high) transition-all duration-150 border-none cursor-pointer',
              'hover:bg-(--surface-active)',
              selectedQ === q && 'bg-(--primary-soft) text-(--primary)',
              isLoading && 'opacity-50',
            )}
          >
            <span className="text-(--on-surface-variant)">{i + 1}</span>
            {q}
          </button>
        ))}
      </div>

      {/* 自由入力 */}
      <div className="flex gap-2 mt-2">
        <input
          ref={inputRef}
          type="text"
          value={customQ}
          onChange={(e) => setCustomQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCustomSubmit();
            }
          }}
          placeholder="自由に質問する..."
          aria-label="記事について自由に質問"
          disabled={isLoading}
          className={cn(
            'flex-1 px-3 py-1.5 rounded-lg text-sm bg-(--surface) border border-(--surface-container-highest) text-(--on-surface)',
            isLoading && 'opacity-50',
          )}
        />
        <button
          type="button"
          onClick={handleCustomSubmit}
          disabled={isLoading || !customQ.trim()}
          className={cn('card-action-btn primary', (isLoading || !customQ.trim()) && 'opacity-40')}
        >
          送信
        </button>
      </div>

      {isLoading && <SummarySkeleton />}

      {answer && !isLoading && (
        <>
          <div className="mt-3 whitespace-pre-wrap text-[0.8125rem] font-normal text-(--on-surface) leading-[1.75]">
            {stripCitations(answer)}
          </div>
          <CitationFooter citations={citations} />
        </>
      )}
    </div>
  );
}
