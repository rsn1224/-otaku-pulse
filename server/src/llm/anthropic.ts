import { AppError } from '../error.ts';
import type { LlmClient, LlmProvider, LlmRequest, LlmResponse } from './types.ts';

// ADR-2: Anthropic Claude クライアント（Messages API）。構造化出力は tool-use で実現。
// API キーはエラーに含めない。

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
/** 既定モデル（ユーザー canon: cloud = claude-opus-4-8）。settings で上書き可。 */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8';

interface AnthropicContentBlock {
  type: string;
  text?: string;
  input?: unknown;
}

export class AnthropicClient implements LlmClient {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = DEFAULT_ANTHROPIC_MODEL) {
    this.apiKey = apiKey;
    this.model = model.length > 0 ? model : DEFAULT_ANTHROPIC_MODEL;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (req.conversation !== null) {
      for (const m of req.conversation) {
        messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
      }
    }
    messages.push({ role: 'user', content: req.userPrompt });

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: req.maxTokens,
      system: req.systemPrompt,
      messages,
    };
    // 構造化出力: 単一ツールへ強制し、input を構造化結果として受け取る。
    if (req.format !== null) {
      body.tools = [
        { name: 'respond', description: '構造化レスポンスを返す', input_schema: req.format },
      ];
      body.tool_choice = { type: 'tool', name: 'respond' };
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (res.status === 401) throw new AppError('unauthorized', 'Anthropic API キーが無効です');
    if (res.status === 429)
      throw new AppError('rate_limit', 'レート制限中です。しばらく待ってください');
    if (!res.ok) throw new AppError('network', `Anthropic HTTP ${res.status}`);

    const json = (await res.json()) as {
      content?: AnthropicContentBlock[];
      model?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const blocks = json.content ?? [];

    let content = '';
    if (req.format !== null) {
      const toolUse = blocks.find((b) => b.type === 'tool_use');
      // downstream は JSON.parse するため input を文字列化して渡す
      content = toolUse?.input !== undefined ? JSON.stringify(toolUse.input) : '';
    } else {
      const text = blocks.find((b) => b.type === 'text');
      content = text?.text ?? '';
    }

    return {
      content,
      provider: 'anthropic',
      model: json.model ?? this.model,
      citations: [],
      usage:
        json.usage !== undefined
          ? {
              promptTokens: json.usage.input_tokens ?? 0,
              completionTokens: json.usage.output_tokens ?? 0,
            }
          : undefined,
    };
  }

  provider(): LlmProvider {
    return 'anthropic';
  }
  supportsWebSearch(): boolean {
    return false;
  }
  supportsStreaming(): boolean {
    return false;
  }
}
