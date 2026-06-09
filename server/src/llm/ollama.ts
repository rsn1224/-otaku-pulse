import { AppError } from '../error.ts';
import { Semaphore } from '../lib/semaphore.ts';
import type { LlmClient, LlmProvider, LlmRequest, LlmResponse } from './types.ts';

// ollama_client.rs の移植。

// ローカル Ollama は単一プロセスのため同時呼び出しを 2 に制限（バースト飽和防止）。
const gate = new Semaphore(2);
const KEEP_ALIVE = '15m';

interface ChatMsg {
  role: string;
  content: string;
}

export class OllamaClient implements LlmClient {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    await gate.acquire();
    try {
      const timeoutMs = req.maxTokens <= 300 ? 30_000 : req.maxTokens <= 600 ? 60_000 : 120_000;

      const messages: ChatMsg[] = [{ role: 'system', content: req.systemPrompt }];
      if (req.conversation !== null) {
        for (const m of req.conversation) messages.push({ role: m.role, content: m.content });
      }
      messages.push({ role: 'user', content: req.userPrompt });

      const temperature = req.format !== null ? 0.0 : 0.2;
      const body: Record<string, unknown> = {
        model: this.model,
        messages,
        stream: false,
        keep_alive: KEEP_ALIVE,
        // qwen3 等の thinking モードを無効化（LLM_STRATEGY.md: 未指定だと推論トークンで 3-5x 遅延）。
        // Rust 版には無い改善。要約/質問生成のレイテンシを実用域に保つ。
        think: false,
        options: { num_predict: req.maxTokens, temperature },
      };
      if (req.format !== null) body.format = req.format;

      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new AppError(
          'network',
          'Ollama が起動していません。`ollama serve` を実行してください',
        );
      }

      if (!res.ok) throw new AppError('network', `Ollama HTTP エラー: ${res.status}`);

      const json = (await res.json()) as {
        message?: { content?: string };
        model?: string;
        done?: boolean;
      };
      if (json.done !== true) throw new AppError('parse', 'Ollama レスポンスが不完全です');

      return {
        content: json.message?.content ?? '',
        provider: 'ollama',
        model: json.model ?? this.model,
        citations: [],
      };
    } finally {
      gate.release();
    }
  }

  /** ADR-5: NDJSON ストリームを読み、各トークンを onToken へ。 */
  async streamComplete(req: LlmRequest, onToken: (chunk: string) => void): Promise<LlmResponse> {
    await gate.acquire();
    try {
      const timeoutMs = req.maxTokens <= 300 ? 30_000 : req.maxTokens <= 600 ? 60_000 : 120_000;
      const messages: ChatMsg[] = [{ role: 'system', content: req.systemPrompt }];
      if (req.conversation !== null) {
        for (const m of req.conversation) messages.push({ role: m.role, content: m.content });
      }
      messages.push({ role: 'user', content: req.userPrompt });

      const body: Record<string, unknown> = {
        model: this.model,
        messages,
        stream: true,
        keep_alive: KEEP_ALIVE,
        think: false,
        options: { num_predict: req.maxTokens, temperature: req.format !== null ? 0.0 : 0.2 },
      };
      if (req.format !== null) body.format = req.format;

      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new AppError(
          'network',
          'Ollama が起動していません。`ollama serve` を実行してください',
        );
      }
      if (!res.ok) throw new AppError('network', `Ollama HTTP エラー: ${res.status}`);

      const reader = res.body?.getReader();
      if (reader === undefined) throw new AppError('network', 'Ollama ストリームを読み取れません');
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      let model = this.model;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl = buffer.indexOf('\n');
        while (nl !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          nl = buffer.indexOf('\n');
          if (line === '') continue;
          try {
            const obj = JSON.parse(line) as {
              message?: { content?: string };
              model?: string;
            };
            const chunk = obj.message?.content ?? '';
            if (chunk.length > 0) {
              full += chunk;
              onToken(chunk);
            }
            if (obj.model !== undefined) model = obj.model;
          } catch {
            // 部分行は無視
          }
        }
      }
      return { content: full, provider: 'ollama', model, citations: [] };
    } finally {
      gate.release();
    }
  }

  provider(): LlmProvider {
    return 'ollama';
  }
  supportsWebSearch(): boolean {
    return false;
  }
  supportsStreaming(): boolean {
    return true;
  }
}

/** Ollama 起動確認 + 利用可能モデル一覧。 */
export async function checkOllamaStatus(baseUrl: string): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new AppError('network', 'Ollama が起動していません');
  }
  if (!res.ok) throw new AppError('network', `Ollama ステータス確認 HTTP エラー: ${res.status}`);
  const json = (await res.json()) as { models?: Array<{ name: string }> };
  return (json.models ?? []).map((m) => m.name);
}
