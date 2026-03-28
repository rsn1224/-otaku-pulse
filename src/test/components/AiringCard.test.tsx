// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiringCard } from '../../components/schedule/AiringCard';
import type { AiringEntry } from '../../types';

const baseEntry: AiringEntry = {
  id: 1,
  episode: 3,
  airingAt: 1700000000,
  mediaId: 100,
  titleNative: null,
  titleRomaji: 'Test Anime',
  coverImageUrl: null,
  totalEpisodes: null,
  siteUrl: null,
};

describe('AiringCard', () => {
  it('renders without crash with minimal props (null image, null siteUrl)', () => {
    const { container } = render(<AiringCard entry={baseEntry} />);
    expect(container).toBeTruthy();
  });

  it('displays titleRomaji when titleNative is null', () => {
    render(<AiringCard entry={baseEntry} />);
    expect(screen.getByText(/Test Anime/)).toBeTruthy();
  });

  it('handles null cover image gracefully by showing fallback', () => {
    const { container } = render(<AiringCard entry={{ ...baseEntry, coverImageUrl: null }} />);
    // Should render the emoji fallback div, not an img element
    const images = container.querySelectorAll('img');
    expect(images.length).toBe(0);
    expect(container.innerHTML).toContain('📺');
  });

  it('renders img element when coverImageUrl is provided', () => {
    const { container } = render(
      <AiringCard entry={{ ...baseEntry, coverImageUrl: 'https://example.com/cover.jpg' }} />,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://example.com/cover.jpg');
  });

  it('displays episode number correctly', () => {
    render(<AiringCard entry={{ ...baseEntry, episode: 5 }} />);
    expect(screen.getByText(/#5/)).toBeTruthy();
  });

  it('displays episode as fraction when totalEpisodes is provided', () => {
    render(<AiringCard entry={{ ...baseEntry, episode: 3, totalEpisodes: 12 }} />);
    expect(screen.getByText(/#3\/12/)).toBeTruthy();
  });

  it('uses titleNative over titleRomaji when titleNative is set', () => {
    render(
      <AiringCard
        entry={{ ...baseEntry, titleNative: 'テストアニメ', titleRomaji: 'Test Anime' }}
      />,
    );
    expect(screen.getByText(/テストアニメ/)).toBeTruthy();
  });
});
