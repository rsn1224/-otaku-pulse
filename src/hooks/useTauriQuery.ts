import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { logger } from '../lib/logger';

interface TauriQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface TauriQueryOptions {
  enabled?: boolean;
}

export function useTauriQuery<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: TauriQueryOptions,
): TauriQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const enabled = options?.enabled ?? true;

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<T>(command, args);
      setData(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error({ command, error: msg }, 'Tauri query failed');
      setError(msg);
      showToast('error', msg);
    } finally {
      setIsLoading(false);
    }
  }, [command, args, showToast]);

  useEffect(() => {
    if (enabled) {
      fetch();
    }
  }, [enabled, fetch]);

  return { data, isLoading, error, refetch: fetch };
}
