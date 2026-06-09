import type { FeedRow } from '../types/models.ts';

// opml_service.rs の移植。

const MAX_FEED_URL_LEN = 2048;

function validateFeedUrl(raw: string): string | null {
  if (raw.length > MAX_FEED_URL_LEN) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function exportOpml(feeds: FeedRow[]): string {
  const byCat = new Map<string, FeedRow[]>();
  for (const f of feeds) {
    const arr = byCat.get(f.category) ?? [];
    arr.push(f);
    byCat.set(f.category, arr);
  }

  let s =
    '<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>OtakuPulse Feeds</title>\n  </head>\n  <body>\n';
  for (const [category, list] of byCat) {
    s += `    <outline text="${category}" title="${category}">\n`;
    for (const f of list) {
      s += `      <outline type="rss" text="${escapeXml(f.name)}" xmlUrl="${escapeXml(f.url)}" />\n`;
    }
    s += '    </outline>\n';
  }
  s += '  </body>\n</opml>\n';
  return s;
}

function extractAttribute(line: string, attr: string): string | null {
  const pattern = `${attr}="`;
  const i = line.indexOf(pattern);
  if (i === -1) return null;
  const start = i + pattern.length;
  const end = line.indexOf('"', start);
  return end === -1 ? null : line.slice(start, end);
}

/** OPML から [name, url, category] を抽出。不正 URL はスキップ。 */
export function parseOpml(xml: string): Array<[string, string, string]> {
  const out: Array<[string, string, string]> = [];
  let currentCategory = '';

  for (const line of xml.split('\n')) {
    const t = line.trim();
    if (t.startsWith('<outline') && !t.includes('type=')) {
      const cat = extractAttribute(t, 'text');
      if (cat !== null) currentCategory = cat;
    }
    if (t.startsWith('<outline') && t.includes('type="rss"')) {
      const name = extractAttribute(t, 'text');
      const xmlUrl = extractAttribute(t, 'xmlUrl');
      if (name !== null && xmlUrl !== null) {
        const valid = validateFeedUrl(xmlUrl);
        if (valid !== null) out.push([name, valid, currentCategory]);
      }
    }
  }
  return out;
}
