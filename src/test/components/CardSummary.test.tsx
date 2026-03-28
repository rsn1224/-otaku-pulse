// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardSummary } from '../../components/discover/CardSummary';

describe('CardSummary', () => {
  it('renders without crash when all props are null', () => {
    // Component should not throw when summary is null and not loading
    const { container } = render(
      <CardSummary summary={null} summaryLoading={false} fallbackSummary={null} />,
    );
    // Returns null — container is an empty div
    expect(container).toBeTruthy();
    expect(container.innerHTML).toBe('');
  });

  it('shows loading skeleton when summaryLoading is true', () => {
    const { container } = render(
      <CardSummary summary={null} summaryLoading={true} fallbackSummary={null} />,
    );
    // SummarySkeleton should render some content
    expect(container.innerHTML).not.toBe('');
  });

  it('renders AI summary text when summary is provided', () => {
    render(
      <CardSummary
        summary="This is a test summary"
        summaryLoading={false}
        fallbackSummary={null}
      />,
    );
    expect(screen.getByText(/AI Summary/i)).toBeTruthy();
    expect(screen.getByText(/test summary/i)).toBeTruthy();
  });

  it('renders fallback summary when summary is null and fallbackSummary is provided', () => {
    render(
      <CardSummary
        summary={null}
        summaryLoading={false}
        fallbackSummary="Fallback description text"
      />,
    );
    expect(screen.getByText(/Fallback description text/i)).toBeTruthy();
  });

  it('prefers AI summary over fallback when both are provided', () => {
    render(
      <CardSummary
        summary="AI generated summary"
        summaryLoading={false}
        fallbackSummary="Fallback text"
      />,
    );
    // AI summary takes precedence
    expect(screen.getByText(/AI Summary/i)).toBeTruthy();
  });
});
