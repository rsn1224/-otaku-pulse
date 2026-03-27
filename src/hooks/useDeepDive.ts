import { invoke } from '@tauri-apps/api/core';
import { useCallback, useState } from 'react';
import type { CardState } from '../components/discover/DiscoverCard';
import { logger } from '../lib/logger';

interface UseDeepDiveResult {
  questions: string[];
  questionsLoading: boolean;
  handleDeepDive: () => Promise<void>;
  setQuestions: (qs: string[]) => void;
}

export const useDeepDive = (
  articleId: number,
  state: CardState,
  setState: (s: CardState) => void,
  recordInteraction: (id: number, kind: string) => void,
): UseDeepDiveResult => {
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const handleDeepDive = useCallback(async (): Promise<void> => {
    if (state === 'deepdive') {
      setState('summary');
      return;
    }
    setQuestions([]);
    setState('deepdive');
    setQuestionsLoading(true);
    recordInteraction(articleId, 'deepdive');
    try {
      const qs = await invoke<string[]>('get_deepdive_questions', { articleId });
      setQuestions(qs);
    } catch (e) {
      logger.warn({ error: e }, 'getDeepDiveQuestions failed');
      setQuestions(['この記事の詳細は？', '関連作品は？', '今後の展開は？']);
    } finally {
      setQuestionsLoading(false);
    }
  }, [articleId, state, setState, recordInteraction]);

  return { questions, questionsLoading, handleDeepDive, setQuestions };
};
