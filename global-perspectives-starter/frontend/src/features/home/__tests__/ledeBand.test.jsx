import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import LedeBand from '@/features/home/components/LedeBand';
import { composeTopicsLede } from '@/features/home/lib/composeTopicsLede';

describe('LedeBand counts', () => {
  it('says "countries involved" (every region the stories name), not a bare country count the cards do not show', () => {
    const topics = [
      { title: 'A', regions: ['France', 'Spain', 'Italy'], primaryCountry: 'France' },
      { title: 'B', regions: ['Spain', 'Chad'], primaryCountry: 'Chad' },
    ];
    const { container } = render(<MemoryRouter><LedeBand {...composeTopicsLede({ topics })} /></MemoryRouter>);
    expect(container.querySelector('.lede-meta').textContent).toBe('2 stories · 4 countries involved');
  });
});
