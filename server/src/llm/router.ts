import { availableProviders, buildClientFor, getLlmSettings } from './settings.ts';
import type { LlmClient, LlmProvider, LlmTask } from './types.ts';

// ADR-2: タスク種別 + 利用可能プロバイダ + グローバル既定から最適プロバイダを選ぶ。
// - web 検索タスク（search/research/deepdive）: grounding/citation のため Perplexity を最優先
// - 品質タスク（digest/summary/questions/...）: 推論品質のため Anthropic(Claude) を最優先
// - いずれも未設定ならグローバル既定（通常 ollama）にフォールバック

const WEB_TASKS: ReadonlySet<LlmTask> = new Set(['search', 'research', 'deepdive']);

/** 純粋関数: タスク + 利用可能集合 + 既定から provider を決める（unit-testable）。 */
export function selectProvider(
  task: LlmTask,
  available: ReadonlySet<LlmProvider>,
  globalProvider: LlmProvider,
): LlmProvider {
  if (WEB_TASKS.has(task) && available.has('perplexity_sonar')) return 'perplexity_sonar';
  if (!WEB_TASKS.has(task) && available.has('anthropic')) return 'anthropic';
  return available.has(globalProvider) ? globalProvider : 'ollama';
}

export function routeFor(task: LlmTask): LlmClient {
  const provider = selectProvider(task, availableProviders(), getLlmSettings().provider);
  return buildClientFor(provider);
}

/** 構築失敗時は null（LLM 任意の経路用）。 */
export function tryRouteFor(task: LlmTask): LlmClient | null {
  try {
    return routeFor(task);
  } catch {
    return null;
  }
}
