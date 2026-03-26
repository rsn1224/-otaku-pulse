import { invoke } from '@tauri-apps/api/core';
import { useCallback, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { logger } from '../lib/logger';

interface TauriCommandResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  execute: (args?: Record<string, unknown>) => Promise<T | null>;
  reset: () => void;
}

export function useTauriCommand<T>(command: string): TauriCommandResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const execute = useCallback(
    async (args?: Record<string, unknown>): Promise<T | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await invoke<T>(command, args);
        setData(result);
        return result;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error({ command, error: msg }, 'Tauri command failed');
        setError(msg);
        showToast('error', msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [command, showToast],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, isLoading, error, execute, reset };
}
