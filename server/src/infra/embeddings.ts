import { AppError } from '../error.ts';

// ADR-7: Ollama embedding（nomic-embed-text 等）。

export async function embedText(baseUrl: string, model: string, text: string): Promise<number[]> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new AppError('network', 'Ollama が起動していません（embedding）');
  }
  if (!res.ok) throw new AppError('network', `Ollama embeddings HTTP ${res.status}`);

  const json = (await res.json()) as { embedding?: number[] };
  if (!Array.isArray(json.embedding) || json.embedding.length === 0) {
    throw new AppError('parse', 'embedding が空です');
  }
  return json.embedding;
}
