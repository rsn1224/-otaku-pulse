import type React from 'react';
import { useRef, useState } from 'react';
import { logger } from '../../lib/logger';
import { askDeepDiveStream } from '../../lib/tauri-commands';
import { stripCitations } from '../../lib/textUtils';
import { cn } from '../../lib/utils';
import type { ChatMessage, Citation } from '../../types';
import { CitationFooter } from './CitationFooter';
import { SummarySkeleton } from './SummarySkeleton';

interface DeepDivePanelProps {
  articleId: number;
  questions: string[];
  onNewQuestions: (questions: string[]) => void;
}

interface DeepDiveTurn {
  id: number;
  question: string;
  answer: string;
  citations: Citation[];
  isError?: boolean;
}

export function DeepDivePanel({
  articleId,
  questions,
  onNewQuestions,
}: DeepDivePanelProps): React.JSX.Element {
  const [turns, setTurns] = useState<DeepDiveTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customQ, setCustomQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(0);
  // 初回マウント時の元提案質問を保持し、リセット時に復帰させる
  const initialQuestionsRef = useRef(questions);

  const handleAsk = async (q: string): Promise<void> => {
    if (isLoading || !q.trim()) return;
    setIsLoading(true);

    // 成功ターンのみを user/assistant の会話履歴に展開する（失敗ターンは LLM へ送らない）
    const priorTurns = turns.filter((t) => !t.isError);
    const history: ChatMessage[] = priorTurns.flatMap((t) => [
      { role: 'user', content: t.question },
      { role: 'assistant', content: t.answer },
    ]);

    // ストリーミングターンを即追加し、トークン到着ごとに answer を更新する。
    const turnId = nextIdRef.current++;
    setTurns((prev) => [...prev, { id: turnId, question: q, answer: '', citations: [] }]);

    try {
      // 履歴が空 = 単発（backend でキャッシュ）、以降は履歴付きフォローアップ。
      const result = await askDeepDiveStream(articleId, q, history, (answerSoFar) => {
        setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, answer: answerSoFar } : t)));
      });
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, answer: result.answer, citations: result.citations ?? [] } : t,
        ),
      );
      if (result.followUpQuestions.length > 0) {
        onNewQuestions(result.followUpQuestions);
      }
    } catch (e) {
      logger.error({ error: e }, 'askDeepDiveStream failed');
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, answer: '回答の取得に失敗しました。', isError: true } : t,
        ),
      );
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

  const handleReset = (): void => {
    setTurns([]);
    onNewQuestions(initialQuestionsRef.current);
  };

  return (
    <div
      id={`deepdive-${articleId}`}
      className="bold-glass-sm rounded-[0.75rem] shadow-(--shadow-md) mt-4 p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-(--on-surface-variant)">深堀りする</p>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className={cn(
              'text-xs text-(--on-surface-variant) bg-transparent border-none cursor-pointer transition-colors duration-150',
              'hover:text-(--on-surface)',
              isLoading && 'opacity-50',
            )}
          >
            会話をリセット
          </button>
        )}
      </div>

      {/* 会話スレッド */}
      {turns.length > 0 && (
        <div className="flex flex-col gap-4 mb-3">
          {turns.map((turn, i) => (
            <div
              key={turn.id}
              className={cn(
                'flex flex-col gap-1.5',
                i > 0 && 'pt-3 border-t border-(--surface-container-highest)',
              )}
            >
              <p className="text-[0.8125rem] font-medium text-(--primary)">Q. {turn.question}</p>
              <div
                className={cn(
                  'whitespace-pre-wrap text-[0.8125rem] font-normal leading-[1.75]',
                  turn.isError ? 'text-(--error)' : 'text-(--on-surface)',
                )}
              >
                {stripCitations(turn.answer)}
              </div>
              <CitationFooter citations={turn.citations} />
            </div>
          ))}
        </div>
      )}

      {/* 最初のトークン到着までスケルトン。以降はストリーミング answer が描画される。 */}
      {isLoading && turns[turns.length - 1]?.answer === '' && <SummarySkeleton />}

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
    </div>
  );
}
