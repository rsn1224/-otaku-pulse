import { describe, expect, it } from 'vitest';
import { extractErrorMessage, isSerializedAppError } from '../../lib/errors';

describe('extractErrorMessage', () => {
  it('reads message from a serialized AppError ({ kind, message })', () => {
    // Tauri invoke errors are plain objects, not Error instances (tauri-v2-gotchas.md).
    expect(extractErrorMessage({ kind: 'Http', message: 'timeout' })).toBe('timeout');
  });

  it('reads message from an Error instance', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns a plain string as-is', () => {
    expect(extractErrorMessage('raw failure')).toBe('raw failure');
  });

  it('falls back for objects without a string message', () => {
    expect(extractErrorMessage({ kind: 'Http' })).toBe('不明なエラーが発生しました');
    expect(extractErrorMessage(null)).toBe('不明なエラーが発生しました');
    expect(extractErrorMessage(undefined)).toBe('不明なエラーが発生しました');
    expect(extractErrorMessage(42)).toBe('不明なエラーが発生しました');
  });
});

describe('isSerializedAppError', () => {
  it('accepts { kind, message } shape', () => {
    expect(isSerializedAppError({ kind: 'Database', message: 'no rows' })).toBe(true);
  });

  it('rejects Error instances and partial shapes', () => {
    expect(isSerializedAppError(new Error('boom'))).toBe(false);
    expect(isSerializedAppError({ message: 'no kind' })).toBe(false);
    expect(isSerializedAppError({ kind: 'Http' })).toBe(false);
    expect(isSerializedAppError(null)).toBe(false);
  });
});
