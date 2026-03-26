import { openUrl } from '@tauri-apps/plugin-opener';
import type React from 'react';
import type { Citation } from '../../types';

const safeHostname = (url: string): string => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url.length > 30 ? `${url.slice(0, 30)}...` : url;
  }
};

interface CitationFooterProps {
  citations: Citation[];
}

export const CitationFooter: React.FC<CitationFooterProps> = ({ citations }) => {
  if (citations.length === 0) return null;

  return (
    <div className="citation-footer">
      <span className="citation-label">Sources</span>
      <div className="citation-list">
        {citations.map((c, i) => (
          <button
            key={c.url}
            type="button"
            className="citation-link"
            onClick={() => openUrl(c.url)}
            title={c.url}
          >
            <span className="citation-number">{i + 1}</span>
            <span className="citation-domain">{safeHostname(c.url)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
