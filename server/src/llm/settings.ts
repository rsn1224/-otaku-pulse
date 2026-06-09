import type { DatabaseSync } from 'node:sqlite';
import { loadSettings, upsertSetting } from '../db/settings.ts';
import { AppError } from '../error.ts';
import {
  ANTHROPIC_ACCOUNT,
  deleteCredential,
  loadCredential,
  PERPLEXITY_ACCOUNT,
  storeCredential,
} from '../infra/credentials.ts';
import { AnthropicClient, DEFAULT_ANTHROPIC_MODEL } from './anthropic.ts';
import { OllamaClient } from './ollama.ts';
import { PerplexityClient } from './perplexity.ts';
import type { LlmClient, LlmProvider } from './types.ts';

// state.rs の LlmSettings + commands/llm.rs の factory 移植 + ADR-2 多プロバイダ。プロセス内シングルトン。

export interface LlmSettings {
  provider: LlmProvider;
  perplexityApiKey: string | null;
  anthropicApiKey: string | null;
  anthropicModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  embeddingModel: string;
}

const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';

const state: LlmSettings = {
  provider: 'ollama',
  perplexityApiKey: null,
  anthropicApiKey: null,
  anthropicModel: DEFAULT_ANTHROPIC_MODEL,
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'qwen3:14b',
  embeddingModel: DEFAULT_EMBEDDING_MODEL,
};

function stripQuotes(s: string): string {
  return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

const VALID_PROVIDERS: LlmProvider[] = ['perplexity_sonar', 'ollama', 'anthropic'];

/** 起動時に DB settings + credential から復元する。 */
export function loadLlmSettings(db: DatabaseSync): void {
  const s = loadSettings(db);
  const prov = s.llm_provider !== undefined ? stripQuotes(s.llm_provider) : '';
  if ((VALID_PROVIDERS as string[]).includes(prov)) state.provider = prov as LlmProvider;
  if (s.ollama_endpoint !== undefined) {
    const v = stripQuotes(s.ollama_endpoint);
    if (v.length > 0) state.ollamaBaseUrl = v;
  }
  if (s.ollama_model !== undefined) {
    const v = stripQuotes(s.ollama_model);
    if (v.length > 0) state.ollamaModel = v;
  }
  if (s.anthropic_model !== undefined) {
    const v = stripQuotes(s.anthropic_model);
    if (v.length > 0) state.anthropicModel = v;
  }
  if (s.embedding_model !== undefined) {
    const v = stripQuotes(s.embedding_model);
    if (v.length > 0) state.embeddingModel = v;
  }
  state.perplexityApiKey = loadCredential(PERPLEXITY_ACCOUNT);
  state.anthropicApiKey = loadCredential(ANTHROPIC_ACCOUNT);
}

export function getLlmSettings(): LlmSettings {
  return { ...state };
}

export function setProvider(db: DatabaseSync, provider: string): void {
  if (!(VALID_PROVIDERS as string[]).includes(provider)) {
    throw new AppError('invalid_input', `未対応の provider: ${provider}`);
  }
  state.provider = provider as LlmProvider;
  upsertSetting(db, 'llm_provider', provider);
}

export function setOllamaSettings(db: DatabaseSync, baseUrl: string, model: string): void {
  state.ollamaBaseUrl = baseUrl;
  state.ollamaModel = model;
  upsertSetting(db, 'ollama_endpoint', baseUrl);
  upsertSetting(db, 'ollama_model', model);
}

export function setPerplexityKey(apiKey: string): void {
  storeCredential(PERPLEXITY_ACCOUNT, apiKey);
  state.perplexityApiKey = apiKey;
}

export function clearPerplexityKey(): void {
  deleteCredential(PERPLEXITY_ACCOUNT);
  state.perplexityApiKey = null;
}

export function setAnthropicKey(apiKey: string): void {
  storeCredential(ANTHROPIC_ACCOUNT, apiKey);
  state.anthropicApiKey = apiKey;
}

export function clearAnthropicKey(): void {
  deleteCredential(ANTHROPIC_ACCOUNT);
  state.anthropicApiKey = null;
}

export function setAnthropicModel(db: DatabaseSync, model: string): void {
  state.anthropicModel = model.length > 0 ? model : DEFAULT_ANTHROPIC_MODEL;
  upsertSetting(db, 'anthropic_model', state.anthropicModel);
}

export function setEmbeddingModel(db: DatabaseSync, model: string): void {
  state.embeddingModel = model.length > 0 ? model : DEFAULT_EMBEDDING_MODEL;
  upsertSetting(db, 'embedding_model', state.embeddingModel);
}

/** 指定 provider のクライアントを構築する（router 用）。鍵未設定なら例外。 */
export function buildClientFor(provider: LlmProvider): LlmClient {
  switch (provider) {
    case 'perplexity_sonar':
      if (state.perplexityApiKey === null) {
        throw new AppError('llm', 'Perplexity API キーが未設定です');
      }
      return new PerplexityClient(state.perplexityApiKey);
    case 'anthropic':
      if (state.anthropicApiKey === null) {
        throw new AppError('llm', 'Anthropic API キーが未設定です');
      }
      return new AnthropicClient(state.anthropicApiKey, state.anthropicModel);
    default:
      return new OllamaClient(state.ollamaBaseUrl, state.ollamaModel);
  }
}

/** 現在のグローバル provider のクライアントを構築する。 */
export function buildLlmClient(): LlmClient {
  return buildClientFor(state.provider);
}

/** 構築失敗時は null（highlights のように LLM 任意の経路で使う）。 */
export function tryBuildLlmClient(): LlmClient | null {
  try {
    return buildLlmClient();
  } catch {
    return null;
  }
}

/** 鍵が設定済みで利用可能な provider の集合。 */
export function availableProviders(): Set<LlmProvider> {
  const set = new Set<LlmProvider>(['ollama']); // ローカルは常に利用可
  if (state.perplexityApiKey !== null) set.add('perplexity_sonar');
  if (state.anthropicApiKey !== null) set.add('anthropic');
  return set;
}
