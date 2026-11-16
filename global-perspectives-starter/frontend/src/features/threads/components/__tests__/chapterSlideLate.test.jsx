import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ChapterSlide } from '@/features/threads/components/StoryMode.jsx';

const late = { writtenAt: '2026-11-16T23:30:00.000Z', slot: '2026-11-15T12:15:00.000Z' };
const chapter = (entries) => ({ key: 'c1', label: 'Chapter', from: '2026-11-12', to: '2026-11-15', country: null, entries, isInflection: false });
const show = (entries) => render(<MemoryRouter><ChapterSlide chapter={chapter(entries)} index={0} /></MemoryRouter>);

describe('ChapterSlide written-late line', () => {
  it('shows the line under the headline of a late entry only', () => {
    show([{ date: '2026-11-12', title: 'Live headline' }, { date: '2026-11-15', title: 'Late headline', writtenLate: late }]);
    const lines = screen.getAllByText('Written 16 Nov from articles saved on 15 Nov');
    expect(lines).toHaveLength(1);
    expect(lines[0].parentElement.textContent).toContain('Late headline');
  });
  it('shows nothing for a malformed marker', () => {
    show([{ date: '2026-11-15', title: 'Headline', writtenLate: { writtenAt: late.writtenAt } }]);
    expect(screen.queryByText(/Written .* from articles saved/)).toBeNull();
  });
});
