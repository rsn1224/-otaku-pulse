// llm_client.rs の trait / 型移植。

export type LlmProvider = 'perplexity_sonar' | 'ollama' | 'anthropic';

/** ルーティング対象のタスク種別（ADR-2 capability routing）。 */
export type LlmTask =
  | 'summary'
  | 'deepdive'
  | 'digest'
  | 'search'
  | 'research'
  | 'questions'
  | 'highlights'
  | 'today'
  | 'memo';

export interface Citation {
  url: string;
  title: string | null;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  webSearch: boolean;
  conversation: ChatMessage[] | null;
  /** 構造化出力スキーマ（Ollama format）。null は自由文。 */
  format: unknown | null;
}

/** ADR-13: プロバイダ報告のトークン使用量（無い場合は呼出側で推定）。 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface LlmResponse {
  content: string;
  provider: LlmProvider;
  model: string;
  citations: Citation[];
  /** プロバイダが返した場合のみ。streaming/未対応時は undefined。 */
  usage?: TokenUsage;
}

export interface LlmClient {
  complete(req: LlmRequest): Promise<LlmResponse>;
  provider(): LlmProvider;
  supportsWebSearch(): boolean;
  /** ADR-5: トークン逐次配信に対応するか。 */
  supportsStreaming(): boolean;
  /** ストリーミング生成。各トークンを onToken に渡し、最終的な完全レスポンスを返す。 */
  streamComplete?(req: LlmRequest, onToken: (chunk: string) => void): Promise<LlmResponse>;
}

export function simpleRequest(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): LlmRequest {
  return {
    systemPrompt,
    userPrompt,
    maxTokens,
    webSearch: false,
    conversation: null,
    format: null,
  };
}

export function structuredRequest(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  schema: unknown,
): LlmRequest {
  return {
    systemPrompt,
    userPrompt,
    maxTokens,
    webSearch: false,
    conversation: null,
    format: schema,
  };
}

/** deepdive cache / provider 一貫性で使う表示名。 */
export function providerDebugName(p: LlmProvider): string {
  switch (p) {
    case 'perplexity_sonar':
      return 'PerplexitySonar';
    case 'anthropic':
      return 'Anthropic';
    default:
      return 'Ollama';
  }
}
