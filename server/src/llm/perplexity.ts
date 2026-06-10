import { AppError } from '../error.ts';
import type { Citation, LlmClient, LlmProvider, LlmRequest, LlmResponse } from './types.ts';

// perplexity_client.rs の移植。API キーをエラーに含めない（leak 防止）。

const BASE_URL = 'https://api.perplexity.ai';
const MODEL = 'sonar-pro';

interface ChatMsg {
  role: string;
  content: string;
}

export class PerplexityClient implements LlmClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const messages: ChatMsg[] = [{ role: 'system', content: req.systemPrompt }];
    if (req.conversation !== null) {
      for (const m of req.conversation) messages.push({ role: m.role, content: m.content });
    }
    messages.push({ role: 'user', content: req.userPrompt });

    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      max_tokens: req.maxTokens,
      temperature: 0.2,
    };
    if (req.webSearch) body.search_recency_filter = 'week';
    // ADR-3: 構造化出力（Sonar は response_format / json_schema 対応）
    if (req.format !== null) {
      body.response_format = { type: 'json_schema', json_schema: { schema: req.format } };
    }

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (res.status === 401) throw new AppError('unauthorized', 'Perplexity API キーが無効です');
    if (res.status === 429) {
      throw new AppError('rate_limit', 'レート制限中です。しばらく待ってください');
    }
    if (!res.ok) throw new AppError('network', `HTTP ${res.status}`);

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      citations?: string[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = json.choices?.[0];
    if (choice === undefined) throw new AppError('parse', 'Perplexity レスポンスが空です');

    const citations: Citation[] = (json.citations ?? []).map((url) => ({ url, title: null }));
    return {
      content: choice.message?.content ?? '',
      provider: 'perplexity_sonar',
      model: json.model ?? MODEL,
      citations,
      usage:
        json.usage !== undefined
          ? {
              promptTokens: json.usage.prompt_tokens ?? 0,
              completionTokens: json.usage.completion_tokens ?? 0,
            }
          : undefined,
    };
  }

  provider(): LlmProvider {
    return 'perplexity_sonar';
  }
  supportsWebSearch(): boolean {
    return true;
  }
  supportsStreaming(): boolean {
    return false;
  }
}
