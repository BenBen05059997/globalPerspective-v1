import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StoryEntryCard from '@/features/threads/components/StoryEntryCard.jsx';

const late = { writtenAt: '2026-11-16T23:30:00.000Z', slot: '2026-11-15T12:15:00.000Z' };
const entry = { title: 'Headline', category: 'politics', sources: [{ source: 'BBC', url: 'https://example.org/a' }] };

describe('StoryEntryCard written-late line', () => {
  it('shows the line for a valid marker, in text, not a link', () => {
    render(<StoryEntryCard entry={{ ...entry, writtenLate: late }} />);
    const line = screen.getByText('Written 16 Nov from articles saved on 15 Nov');
    expect(line.closest('a, button')).toBeNull();
  });
  it('shows nothing for a live entry or a malformed marker', () => {
    const { rerender } = render(<StoryEntryCard entry={entry} />);
    expect(screen.queryByText(/Written .* from articles saved/)).toBeNull();
    rerender(<StoryEntryCard entry={{ ...entry, writtenLate: { writtenAt: late.writtenAt, slot: 'bad' } }} />);
    expect(screen.queryByText(/Written .* from articles saved/)).toBeNull();
  });
});
