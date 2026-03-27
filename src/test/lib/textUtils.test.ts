import { describe, expect, it } from 'vitest';
import { containsHtml, sanitizeHtml, stripCitations } from '../../lib/textUtils';

describe('stripCitations', () => {
  it('removes numbered citations [1] [2]', () => {
    expect(stripCitations('Hello [1] world [2]')).toBe('Hello world');
  });

  it('removes footnote citations [^1]', () => {
    expect(stripCitations('Text [^1] more [^23]')).toBe('Text more');
  });

  it('removes [本文] marker', () => {
    expect(stripCitations('結果 [本文] です')).toBe('結果 です');
  });

  it('removes bold markers **', () => {
    expect(stripCitations('**bold** text')).toBe('bold text');
  });

  it('trims whitespace', () => {
    expect(stripCitations('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(stripCitations('')).toBe('');
  });

  it('handles text with no citations', () => {
    expect(stripCitations('plain text')).toBe('plain text');
  });
});

describe('containsHtml', () => {
  it('detects opening tags', () => {
    expect(containsHtml('<p>hello</p>')).toBe(true);
  });

  it('detects self-closing tags', () => {
    expect(containsHtml('<br/>')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(containsHtml('just text')).toBe(false);
  });

  it('returns false for angle brackets in math', () => {
    expect(containsHtml('5 < 10')).toBe(false);
  });

  it('detects tags with attributes', () => {
    expect(containsHtml('<a href="url">link</a>')).toBe(true);
  });
});

describe('sanitizeHtml', () => {
  it('removes script tags', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>hello')).toBe('hello');
  });

  it('removes style tags', () => {
    expect(sanitizeHtml('<style>body{}</style>hello')).toBe('hello');
  });

  it('removes event handlers', () => {
    const input = '<div onclick="alert(1)">test</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('test');
  });

  it('keeps allowed tags', () => {
    expect(sanitizeHtml('<p>hello</p>')).toBe('<p>hello</p>');
  });

  it('strips disallowed tags', () => {
    expect(sanitizeHtml('<iframe>bad</iframe>')).toBe('bad');
  });

  it('keeps safe href attributes', () => {
    const input = '<a href="https://example.com">link</a>';
    expect(sanitizeHtml(input)).toContain('href="https://example.com"');
  });

  it('strips javascript: urls', () => {
    const input = '<a href="javascript:alert(1)">link</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
  });

  it('strips disallowed attributes', () => {
    const input = '<div data-custom="val" class="ok">text</div>';
    const result = sanitizeHtml(input);
    expect(result).toContain('class="ok"');
    expect(result).not.toContain('data-custom');
  });

  it('handles nested allowed tags', () => {
    const input = '<p><strong>bold</strong> and <em>italic</em></p>';
    expect(sanitizeHtml(input)).toBe('<p><strong>bold</strong> and <em>italic</em></p>');
  });
});
