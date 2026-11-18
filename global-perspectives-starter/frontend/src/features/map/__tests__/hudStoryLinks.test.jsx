// Map story links open the normal story page (story mode), the same as story links on every other tab.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import HudIntelFeed from '@/features/map/components/HudIntelFeed.jsx';

describe('HudIntelFeed direct story links', () => {
  it('links each row to the plain story page', () => {
    const topics = [{ threadId: 'thread-oil-1', title: 'Oil prices climb' }];
    render(
      <MemoryRouter>
        <HudIntelFeed topics={topics} topicsAsOf={new Date().toISOString()} directLimit={3} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Oil prices climb/ })).toHaveAttribute('href', '/weekly/thread/thread-oil-1');
  });
});
