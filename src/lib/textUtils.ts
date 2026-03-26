/** LLM 出力の引用マーカー [1][2] [^1] [本文] などを除去 */
export const stripCitations = (text: string): string =>
  text
    .replace(/\s*\[\^?\d+\]/g, '')
    .replace(/\s*\[本文\]/g, '')
    .replace(/\*\*/g, '')
    .trim();
