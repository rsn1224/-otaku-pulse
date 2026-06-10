import { recordLlmCall } from '../db/metrics.ts';
import { estimateCostUsd, estimateTokens } from './cost.ts';
import { availableProviders, buildClientFor, getLlmSettings } from './settings.ts';
import type { LlmClient, LlmProvider, LlmRequest, LlmResponse, LlmTask } from './types.ts';

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

// ADR-13: routeFor seam で全 LLM 呼出を計測する。db を持たず recordLlmCall（sink singleton）へ。
function record(task: LlmTask, req: LlmRequest, res: LlmResponse, startedAt: number): void {
  const promptTokens = res.usage?.promptTokens ?? estimateTokens(req.systemPrompt + req.userPrompt);
  const completionTokens = res.usage?.completionTokens ?? estimateTokens(res.content);
  recordLlmCall({
    provider: res.provider,
    model: res.model,
    task,
    promptTokens,
    completionTokens,
    latencyMs: Date.now() - startedAt,
    costUsd: estimateCostUsd(res.model, promptTokens, completionTokens),
  });
}

/** complete/streamComplete を計測でラップする（成功した呼出を記録）。 */
function instrument(client: LlmClient, task: LlmTask): LlmClient {
  const inner = client.streamComplete?.bind(client);
  return {
    provider: () => client.provider(),
    supportsWebSearch: () => client.supportsWebSearch(),
    supportsStreaming: () => client.supportsStreaming(),
    async complete(req) {
      const t = Date.now();
      const res = await client.complete(req);
      record(task, req, res, t);
      return res;
    },
    streamComplete:
      inner === undefined
        ? undefined
        : async (req, onToken) => {
            const t = Date.now();
            const res = await inner(req, onToken);
            record(task, req, res, t);
            return res;
          },
  };
}

export function routeFor(task: LlmTask): LlmClient {
  const provider = selectProvider(task, availableProviders(), getLlmSettings().provider);
  return instrument(buildClientFor(provider), task);
}

/** 構築失敗時は null（LLM 任意の経路用）。 */
export function tryRouteFor(task: LlmTask): LlmClient | null {
  try {
    return routeFor(task);
  } catch {
    return null;
  }
}
