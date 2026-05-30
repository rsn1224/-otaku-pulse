// @vitest-environment jsdom

import { invoke } from '@tauri-apps/api/core';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/common/Toast';
import { useTauriCommand } from '../../hooks/useTauriCommand';

const mockedInvoke = vi.mocked(invoke);

const wrapper = ({ children }: { children: React.ReactNode }) => ToastProvider({ children });

describe('useTauriCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data on successful invoke', async () => {
    mockedInvoke.mockResolvedValueOnce({ id: 1, name: 'test' });
    const { result } = renderHook(() => useTauriCommand<{ id: number; name: string }>('test_cmd'), {
      wrapper,
    });

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toEqual({ id: 1, name: 'test' });
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('extracts message from Tauri plain object error (not Error instance)', async () => {
    // Tauri invoke errors are plain objects: { kind: 'Http', message: 'timeout' }
    // NOT Error instances — error instanceof Error is always false (tauri-v2-gotchas.md).
    // extractErrorMessage reads the `message` field instead of String(e) → '[object Object]'.
    mockedInvoke.mockRejectedValueOnce({ kind: 'Http', message: 'timeout' });
    const { result } = renderHook(() => useTauriCommand('test_cmd'), { wrapper });

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('timeout');
  });

  it('handles standard Error instance', async () => {
    mockedInvoke.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useTauriCommand('test_cmd'), { wrapper });

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error).toContain('Network error');
  });

  it('sets isLoading to true during execution', async () => {
    let resolvePromise!: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockedInvoke.mockReturnValueOnce(promise as Promise<unknown>);

    const { result } = renderHook(() => useTauriCommand('test_cmd'), { wrapper });

    let executePromise!: Promise<unknown>;
    act(() => {
      executePromise = result.current.execute();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise('done');
      await executePromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('reset clears data and error', async () => {
    mockedInvoke.mockResolvedValueOnce('data');
    const { result } = renderHook(() => useTauriCommand('test_cmd'), { wrapper });

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.data).toBe('data');

    act(() => {
      result.current.reset();
    });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
