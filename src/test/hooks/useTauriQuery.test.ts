// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { ToastProvider } from '../../components/common/Toast';
import { useTauriQuery } from '../../hooks/useTauriQuery';

const mockedInvoke = vi.mocked(invoke);

const wrapper = ({ children }: { children: React.ReactNode }) =>
  ToastProvider({ children });

describe('useTauriQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches data on mount', async () => {
    mockedInvoke.mockResolvedValue([{ id: 1 }]);
    const { result } = renderHook(() => useTauriQuery<{ id: number }[]>('list_items'), {
      wrapper,
    });

    await vi.waitFor(() => {
      expect(result.current.data).toEqual([{ id: 1 }]);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('handles Tauri plain object error on fetch', async () => {
    // Tauri invoke errors are plain objects: { kind: 'Database', message: 'connection failed' }
    // NOT Error instances (tauri-v2-gotchas.md)
    // The hook uses `String(e)` since `e instanceof Error` is false
    // This produces '[object Object]' — documents the plain-object error behavior
    mockedInvoke.mockRejectedValue({ kind: 'Database', message: 'connection failed' });
    const { result } = renderHook(() => useTauriQuery('list_items'), { wrapper });

    await vi.waitFor(
      () => {
        // After the rejected fetch settles, error should be set
        expect(result.current.error).not.toBeNull();
      },
      { timeout: 2000 },
    );
    expect(result.current.data).toBeNull();
    // Documents the string type — String(plainObj) = '[object Object]'
    expect(typeof result.current.error).toBe('string');
  });

  it('refetch triggers new invoke call', async () => {
    mockedInvoke.mockResolvedValue([{ id: 1 }]);
    const { result } = renderHook(() => useTauriQuery('list_items'), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual([{ id: 1 }]);
    });

    const callsBefore = mockedInvoke.mock.calls.length;

    mockedInvoke.mockResolvedValue([{ id: 2 }]);
    await act(async () => {
      await result.current.refetch();
    });

    expect(mockedInvoke.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(result.current.data).toEqual([{ id: 2 }]);
  });

  it('does not fetch when enabled is false', () => {
    renderHook(() => useTauriQuery('list_items', undefined, { enabled: false }), {
      wrapper,
    });

    expect(mockedInvoke).not.toHaveBeenCalled();
  });
});
