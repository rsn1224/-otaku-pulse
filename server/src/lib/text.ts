// rss_helpers.rs の text ユーティリティ移植。

/** 簡易言語判定: 日本語文字を含めば 'ja'、それ以外は 'en'。 */
export function detectLanguage(title: string, content: string | null): 'ja' | 'en' {
  const text = `${title} ${content ?? ''}`;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c === undefined) continue;
    if (
      (c >= 0x3040 && c <= 0x309f) || // ひらがな
      (c >= 0x30a0 && c <= 0x30ff) || // カタカナ
      (c >= 0x4e00 && c <= 0x9fff) // 漢字
    ) {
      return 'ja';
    }
  }
  return 'en';
}

export function isImageUrl(url: string): boolean {
  const l = url.toLowerCase();
  return (
    l.includes('.jpg') ||
    l.includes('.jpeg') ||
    l.includes('.png') ||
    l.includes('.webp') ||
    l.includes('.gif')
  );
}

/** HTML から最初の <img> の src を抽出。data: URL・短すぎる URL は除外。 */
export function extractImgFromHtml(html: string): string | null {
  const imgStart = html.indexOf('<img ');
  if (imgStart === -1) return null;
  const afterImg = html.slice(imgStart);

  let srcStart = afterImg.indexOf('src="');
  let quote = '"';
  if (srcStart === -1) {
    srcStart = afterImg.indexOf("src='");
    quote = "'";
  }
  if (srcStart === -1) return null;

  const urlStart = srcStart + 5;
  const urlEnd = afterImg.slice(urlStart).indexOf(quote);
  if (urlEnd === -1) return null;
  const url = afterImg.slice(urlStart, urlStart + urlEnd);

  if (url.startsWith('data:') || url.length < 10) return null;
  return url;
}
