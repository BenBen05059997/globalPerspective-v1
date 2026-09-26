// AboutContact wording (F4, review R2): no invented fixed-rate claims ("hundreds of articles
// daily", "every hour", "every 4 hours") — "when the pipeline runs" plus a real computed
// paused-since date instead.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let briefValue;
vi.mock('@/features/daily/hooks/useDailyBrief', () => ({
  useDailyBrief: () => briefValue,
  MAX_LOOKBACK_DAYS: 30,
}));

import AboutContact from '@/features/static/AboutContact';

function renderAbout() {
  return render(
    <MemoryRouter>
      <AboutContact />
    </MemoryRouter>
  );
}

beforeEach(() => {
  briefValue = { brief: { generatedAt: new Date().toISOString() }, loading: false, error: null };
});

describe('AboutContact', () => {
  it('never claims a fixed rate the paused pipeline cannot back up', () => {
    renderAbout();
    const body = document.body.textContent;
    expect(body).not.toMatch(/hundreds of articles daily/i);
    expect(body).not.toMatch(/every hour/i);
    expect(body).not.toMatch(/every 4 hours/i);
    expect(body).toMatch(/when the pipeline runs/i);
  });

  it('adds a computed "analysis paused since <date>" note when analysis is paused', () => {
    const old = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(); // 40h — past the 36h threshold
    briefValue = { brief: { generatedAt: old }, loading: false, error: null };
    renderAbout();
    expect(screen.getByText(/Analysis has been paused since/)).toBeInTheDocument();
  });

  it('adds no paused note when analysis is fresh', () => {
    renderAbout();
    expect(screen.queryByText(/Analysis has been paused/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Analysis is currently paused/)).not.toBeInTheDocument();
  });
});
