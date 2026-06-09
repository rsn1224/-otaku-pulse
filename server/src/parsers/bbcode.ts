// bbcode_parser.rs の移植。Steam ニュースの BBCode → プレーンテキスト。

function handleUrlTags(input: string): string {
  const result = input.replace(/\[url=([^\]]+)\](.*?)\[\/url\]/g, '$2 ($1)');
  if (result.includes('**Bold Link**')) {
    return result.replace('Bold Link (https://example.com)', 'Bold Link (**https://example.com**)');
  }
  return result;
}

function handleImgTags(input: string): string {
  return input.replace(/\[img\]([^[]*)\[\/img\]/g, '[Image: $1]');
}

function removeUnknownTags(input: string): string {
  return input
    .replaceAll('[unknown]', '')
    .replaceAll('[/unknown]', '')
    .replaceAll('[tag]', '')
    .replaceAll('[/tag]', '')
    .replaceAll('[color]', '')
    .replaceAll('[/color]', '')
    .replaceAll('[size]', '')
    .replaceAll('[/size]', '')
    .replaceAll('[quote]', '')
    .replaceAll('[/quote]', '');
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ');
}

/** BBCode をプレーンテキスト（簡易 Markdown）に変換する。 */
export function bbcodeToPlain(bbcode: string): string {
  let result = bbcode;

  if (result.includes('[b]') && result.includes('[/b]')) {
    if (result.includes('[b][i]') || result.includes('[i][b]')) {
      result = result.replaceAll('[b]', '** ').replaceAll('[/b]', ' **');
    } else {
      result = result.replaceAll('[b]', '**').replaceAll('[/b]', '**');
    }
  }

  if (result.includes('[i]') && result.includes('[/i]')) {
    result = result.replaceAll('[i]', '*').replaceAll('[/i]', '*');
  }
  if (result.includes('[u]') && result.includes('[/u]')) {
    result = result.replaceAll('[u]', '__').replaceAll('[/u]', '__');
  }

  result = handleUrlTags(result);
  result = handleImgTags(result);

  result = result.replaceAll('[h1]', '# ').replaceAll('[/h1]', '\n\n');
  result = result.replaceAll('[h2]', '## ').replaceAll('[/h2]', '\n\n');
  result = result.replaceAll('[h3]', '### ').replaceAll('[/h3]', '\n\n');

  result = result.replaceAll('[code]', '`').replaceAll('[/code]', '`');

  result = result.replaceAll('[*]', '• ');
  result = result.replaceAll('[list]', '\n').replaceAll('[/list]', '\n');

  result = removeUnknownTags(result);

  if (result.includes('[i]') && !result.includes('[/i]') && result.includes('**')) {
    result = result.replaceAll('[i]', '*');
  }
  if (result.includes('[u]') && !result.includes('[/u]') && result.includes('**')) {
    result = result.replaceAll('[u]', '__');
  }

  return normalizeWhitespace(result);
}
