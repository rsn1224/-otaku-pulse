/**
 * テキスト内のキーワード位置を特定する
 * React コンポーネントで <mark> タグに変換するための情報を返す
 */
export interface HighlightSegment {
  text: string;
  isHighlighted: boolean;
}

export function getHighlightSegments(text: string, keywords: string[]): HighlightSegment[] {
  if (keywords.length === 0 || !text) {
    return [{ text, isHighlighted: false }];
  }

  const sortedKeywords = [...keywords].filter((k) => k.trim()).sort((a, b) => b.length - a.length);

  if (sortedKeywords.length === 0) {
    return [{ text, isHighlighted: false }];
  }

  const pattern = sortedKeywords.map(escapeRegExp).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  return parts
    .filter((part) => part !== '')
    .map((part) => ({
      text: part,
      isHighlighted: sortedKeywords.some((kw) => part.toLowerCase() === kw.toLowerCase()),
    }));
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
