// deepdive_helpers.rs の移植（構造化出力フォールバックパース）。

/** JSON 配列をエラー耐性ありでパース。直接 → [..] 抽出 → 行分割の順。 */
export function parseQuestionArray(raw: string): string[] {
  try {
    const arr = JSON.parse(raw.trim()) as unknown;
    if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) return arr as string[];
  } catch {
    // fallthrough
  }

  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const arr = JSON.parse(raw.slice(start, end + 1)) as unknown;
      if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) return arr as string[];
    } catch {
      // fallthrough
    }
  }

  return raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .slice(0, 3)
    .map((l) => l.trim().replace(/^["[\],]+|["[\],]+$/g, ''));
}

/** 回答 + フォローアップ質問を `---FOLLOWUP---` で分割。 */
export function parseAnswerWithFollowups(raw: string): [string, string[]] {
  const idx = raw.indexOf('---FOLLOWUP---');
  if (idx !== -1) {
    const answer = raw.slice(0, idx).trim();
    const followUps = parseQuestionArray(raw.slice(idx + 14));
    return [answer, followUps];
  }
  return [raw.trim(), []];
}

/** 構造化出力 `{"<field>": [...]}` を取り出す。失敗時は null。 */
export function parseStringArrayField(content: string, field: string): string[] | null {
  try {
    const obj = JSON.parse(content.trim()) as Record<string, unknown>;
    const arr = obj[field];
    if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) return arr as string[];
  } catch {
    // fallthrough
  }
  return null;
}
