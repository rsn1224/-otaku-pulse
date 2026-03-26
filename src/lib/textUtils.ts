/** LLM 出力の引用マーカー [1][2] [^1] [本文] などを除去 */
export const stripCitations = (text: string): string =>
  text
    .replace(/\s*\[\^?\d+\]/g, '')
    .replace(/\s*\[本文\]/g, '')
    .replace(/\*\*/g, '')
    .trim();

const HTML_TAG_RE = /<\/?[a-z][\s\S]*?>/i;

/** テキストが HTML を含むかどうかを判定 */
export const containsHtml = (text: string): boolean => HTML_TAG_RE.test(text);

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'b',
  'i',
  'em',
  'strong',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'code',
  'img',
  'figure',
  'figcaption',
  'span',
  'div',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'sup',
  'sub',
  'del',
  's',
]);

const ALLOWED_ATTRS = new Set(['href', 'src', 'alt', 'title', 'class', 'width', 'height']);

/** URL 属性 (href/src) に許可するプロトコルのみ通す */
const URL_ATTRS = new Set(['href', 'src']);
const isSafeUrl = (value: string): boolean => {
  const t = value.trim().toLowerCase();
  return (
    t.startsWith('https://') || t.startsWith('http://') || t.startsWith('/') || t.startsWith('#')
  );
};

/** HTML を許可タグ・属性のみに制限するシンプルなサニタイザ */
export const sanitizeHtml = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*\/?>/gi, (match, tag: string) => {
      const lower = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(lower)) return '';
      if (match.startsWith('</')) return `</${lower}>`;
      const attrs: string[] = [];
      const attrRe = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(match)) !== null) {
        const name = m[1].toLowerCase();
        const value = m[2] ?? m[3];
        if (!ALLOWED_ATTRS.has(name)) continue;
        if (URL_ATTRS.has(name) && !isSafeUrl(value)) continue;
        attrs.push(`${name}="${value}"`);
      }
      const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
      const selfClose = match.endsWith('/>') ? ' /' : '';
      return `<${lower}${attrStr}${selfClose}>`;
    });
