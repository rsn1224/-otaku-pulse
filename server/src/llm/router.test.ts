import { describe, expect, test } from 'vitest';
import { selectProvider } from './router.ts';
import type { LlmProvider } from './types.ts';

const set = (...p: LlmProvider[]): Set<LlmProvider> => new Set(p);

describe('selectProvider (ADR-2 capability routing)', () => {
  test('web タスクは Perplexity を最優先', () => {
    expect(selectProvider('search', set('ollama', 'perplexity_sonar', 'anthropic'), 'ollama')).toBe(
      'perplexity_sonar',
    );
    expect(selectProvider('deepdive', set('ollama', 'perplexity_sonar'), 'ollama')).toBe(
      'perplexity_sonar',
    );
  });

  test('品質タスクは Anthropic を最優先', () => {
    expect(selectProvider('digest', set('ollama', 'anthropic'), 'ollama')).toBe('anthropic');
    expect(
      selectProvider('summary', set('ollama', 'perplexity_sonar', 'anthropic'), 'ollama'),
    ).toBe('anthropic');
  });

  test('web タスクで Perplexity 無ければグローバル既定へ', () => {
    expect(selectProvider('search', set('ollama', 'anthropic'), 'ollama')).toBe('ollama');
    expect(selectProvider('research', set('ollama'), 'ollama')).toBe('ollama');
  });

  test('品質タスクで Anthropic 無ければグローバル既定へ', () => {
    expect(selectProvider('digest', set('ollama', 'perplexity_sonar'), 'perplexity_sonar')).toBe(
      'perplexity_sonar',
    );
    expect(selectProvider('summary', set('ollama'), 'ollama')).toBe('ollama');
  });

  test('グローバル既定が利用不可なら ollama', () => {
    expect(selectProvider('summary', set('ollama'), 'perplexity_sonar')).toBe('ollama');
  });
});
