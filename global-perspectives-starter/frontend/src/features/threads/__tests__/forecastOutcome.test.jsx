// One verdict wording for the WATCH slide and the forecast block (decision 0038, S9); source rows (S11).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { triggerState, outcomeTag } from '@/features/threads/lib/forecastOutcome.js';
import { WatchSlide } from '@/features/threads/components/StoryMode.jsx';
import ThreadForecast from '@/features/threads/components/ThreadForecast.jsx';
import { rollupSources, rollupCounts } from '@/features/threads/lib/sourceRollup.js';

describe('forecastOutcome', () => {
  it('maps verdicts and states to the 0038 words', () => {
    expect(outcomeTag({ verdict: 'fired' })).toBe('happened');
    expect(outcomeTag({ verdict: 'not_fired' })).toBe('not reported');
    expect(outcomeTag({ state: 'yes' })).toBe('happened');
    expect(outcomeTag({ state: 'no' })).toBe('not reported');
    expect(outcomeTag({ state: 'void' })).toBe('could not be checked');
    expect(outcomeTag({ state: 'past_deadline_unchecked' })).toBe('awaiting check');
    expect(outcomeTag({ deadline: '2099-01-01' })).toBeNull();
  });
  it('"today" is read per call, not frozen', () => {
    expect(triggerState({ deadline: '2026-11-05' }, '2026-11-04')).toBe('pending');
    expect(triggerState({ deadline: '2026-11-05' }, '2026-11-06')).toBe('awaiting');
  });
  it('the WATCH slide and the forecast block print the same words, never the raw enum', () => {
    const t = { id: '0-0', text: 'Q one', label: 'Q one', deadline: '2026-10-20', verdict: 'not_fired', scenarioLabel: 'S' };
    render(<MemoryRouter><WatchSlide deadlines={[t]} /></MemoryRouter>);
    expect(screen.getByText(/· not reported/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/not_fired/);
    render(<MemoryRouter><ThreadForecast snapshot={{ scenarios: [{ label: 'S', triggers: [t] }] }} /></MemoryRouter>);
    expect(screen.getByText(/Oct 20 · not reported/)).toBeInTheDocument();
  });
});

describe('ThreadForecast scenario heading', () => {
  it('does not repeat a question that is also the scenario\'s name', () => {
    const t = { id: '0-0', text: 'Country A ratifies the treaty', deadline: '2099-01-01' };
    render(<MemoryRouter><ThreadForecast snapshot={{ scenarios: [{ label: t.text, probability: 0.7, triggers: [t] }, { label: 'Most Likely', triggers: [{ ...t, id: '1-0', text: 'Other' }] }] }} /></MemoryRouter>);
    expect(screen.getAllByText('Country A ratifies the treaty')).toHaveLength(1);
    expect(screen.getByText('Most Likely')).toBeInTheDocument();
  });
});

describe('rollupSources', () => {
  it('one tier rule: secondary only if every item is; missing tier is primary; counts add up', () => {
    const rows = rollupSources([
      { date: '2026-09-20', sources: [{ source: 'AP', tier: 'secondary' }, { source: 'AP', tier: 'primary' }, { source: 'B', tier: 'secondary' }, { source: 'C' }] },
      { date: '2026-09-21', sources: [{ source: 'B', tier: 'secondary' }] },
    ]);
    expect(Object.fromEntries(rows.map((r) => [r.name, r.tier]))).toEqual({ AP: 'primary', B: 'secondary', C: 'primary' });
    expect(rows.find((r) => r.name === 'B')).toMatchObject({ count: 2, latest: '2026-09-21' });
    expect(rollupCounts(rows)).toEqual({ outlets: 3, primary: 2, secondary: 1 });
  });
});
