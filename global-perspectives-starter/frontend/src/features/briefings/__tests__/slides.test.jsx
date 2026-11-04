// Slide bodies: "TOP STORY n of N" counts the brief's own top stories; the weekly deck headline
// uses the same date format as the weekly read mode.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('@/features/briefings/hooks/useStoryQuestion.js', () => ({ useStoryQuestion: () => null }));
vi.mock('@/shared/ui/SubscribeCard', () => ({ default: () => null }));

import { SlideBody } from '@/features/briefings/components/BriefingSlides.jsx';

describe('SlideBody', () => {
  it('"TOP STORY n of N" uses the number of top stories the brief carries', () => {
    const topStories = [{ title: 'A', category: 'conflict' }, { title: 'B', category: 'economy' }, { title: 'C', category: 'conflict' }];
    render(<MemoryRouter><SlideBody mode="daily" slide={{ kind: 'story', story: topStories[1], index: 1 }} brief={{ topStories }} /></MemoryRouter>);
    expect(screen.getByText(/TOP STORY 2 of 3/)).toBeInTheDocument();
  });

  it('the weekly deck headline reads the week like the weekly read mode, not as an ISO date', () => {
    render(<MemoryRouter><SlideBody mode="weekly" slide={{ kind: 'week' }} brief={{ weekOf: '2026-11-01' }} /></MemoryRouter>);
    expect(screen.getByText(/WEEKLY · week ending Sun, Nov 1/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('2026-11-01');
  });
});
