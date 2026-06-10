// ADR-13: LLM コスト「推定」。billing ではなく可視化用。
// 価格は 1M トークンあたり USD（公開価格の概算・変動するため要更新）。
// ローカル Ollama（qwen3 等）は API 課金ゼロなので表に無い → 0。

interface TokenPrice {
  /** 入力 1M トークンあたり USD。 */
  input: number;
  /** 出力 1M トークンあたり USD。 */
  output: number;
}

// model 名の部分一致で引く（claude-opus-4-8 / sonar-pro 等の version 差を吸収）。
const PRICE_TABLE: ReadonlyArray<{ match: string; price: TokenPrice }> = [
  { match: 'opus', price: { input: 15, output: 75 } },
  { match: 'sonnet', price: { input: 3, output: 15 } },
  { match: 'haiku', price: { input: 0.8, output: 4 } },
  { match: 'sonar', price: { input: 3, output: 15 } },
];

function priceFor(model: string): TokenPrice {
  const m = model.toLowerCase();
  for (const p of PRICE_TABLE) {
    if (m.includes(p.match)) return p.price;
  }
  return { input: 0, output: 0 }; // ローカル / 未知モデルは推定不可 → 0
}

/** prompt/completion トークン数から推定コスト（USD）を返す。 */
export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = priceFor(model);
  return (promptTokens * p.input + completionTokens * p.output) / 1_000_000;
}

/** usage がレスポンスに無い時の粗いトークン推定（混在 JP/EN を ~4 chars/token と概算）。 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}
