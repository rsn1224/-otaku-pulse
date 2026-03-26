import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useRef, useState } from 'react';
import { stripCitations } from '../../lib/textUtils';
import type { Citation, DeepDiveResult } from '../../types';
import { CitationFooter } from './CitationFooter';
import { SummarySkeleton } from './SummarySkeleton';

interface DeepDivePanelProps {
  articleId: number;
  questions: string[];
  onNewQuestions: (questions: string[]) => void;
}

export const DeepDivePanel: React.FC<DeepDivePanelProps> = ({
  articleId,
  questions,
  onNewQuestions,
}) => {
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
    } catch (_) {
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
    <div className="deepdive-panel">
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-source)' }}>
        深堀りする
      </p>

      {/* 提案質問 */}
      <div className="flex flex-col gap-1">
        {questions.map((q, i) => (
          <button
            key={`${q}-${i}`}
            type="button"
            disabled={isLoading}
            onClick={() => handleAsk(q)}
            className="deepdive-question-btn"
            style={
              selectedQ === q
                ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                : isLoading
                  ? { opacity: 0.5 }
                  : undefined
            }
          >
            <span style={{ color: 'var(--text-source)' }}>{i + 1}</span>
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
          disabled={isLoading}
          className="flex-1 px-3 py-1.5 rounded-lg text-sm"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            opacity: isLoading ? 0.5 : 1,
          }}
        />
        <button
          type="button"
          onClick={handleCustomSubmit}
          disabled={isLoading || !customQ.trim()}
          className="card-action-btn primary"
          style={{ opacity: isLoading || !customQ.trim() ? 0.4 : 1 }}
        >
          送信
        </button>
      </div>

      {isLoading && <SummarySkeleton />}

      {answer && !isLoading && (
        <>
          <div className="ai-summary mt-3 whitespace-pre-wrap">{stripCitations(answer)}</div>
          <CitationFooter citations={citations} />
        </>
      )}
    </div>
  );
};
