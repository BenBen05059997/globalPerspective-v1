// Desktop: Esc closes the open situation card (?focus= dropped like the back button does) and
// returns focus to that situation's Alerts row. Esc in a text field, or with nothing open, does nothing.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

let SITUATIONS = [];
vi.mock('@/features/map/hooks/useWorld.js', () => ({
  useWorld: () => ({
    world: { schema: 1, generated_at: '2026-09-26T05:13:59Z', sources: { gdacs: '2026-09-26T05:05:07Z', news: '2026-09-26T04:50:16Z' }, situations: SITUATIONS },
    situations: SITUATIONS, loading: false, error: null, asOf: '2026-09-26T04:50:16Z', stale: false,
  }),
  useSituationDetail: () => ({ detail: null }),
}));
vi.mock('@/shared/hooks/useDailyBrief.js', () => ({
  useDailyBrief: () => ({ brief: null, servedDateKey: null, loading: false, error: null }),
  MAX_LOOKBACK_DAYS: 30,
}));
vi.mock('@/shared/data/useGeminiTopics.js', () => ({
  useGeminiTopics: () => ({ topics: [], loading: false, error: null, isStale: false, updatedAt: null, generatedDate: null }),
}));

const base = { iso3_affected: [], affected_names: [], threadId: null, centroid: { lat: 10, lon: 10 } };
const NOW = new Date().toISOString();
const A = { ...base, id: 'news#a', source: 'news', verb_label: 'Sudan — fighting', axis: 'conflict', tier: 'high', state: 'peak', escalating: false, affected_names: ['Sudan'], opened_at: NOW, last_change_at: NOW };
const B = { ...base, id: 'gdacs#TC#1', source: 'gdacs', verb_label: 'Mexico — tropical cyclone', axis: 'humanitarian', tier: 'elevated', state: 'emerging', escalating: false, affected_names: ['Mexico'], opened_at: NOW, last_change_at: NOW };

function Loc() { return <div data-testid="loc">{useLocation().search}</div>; }
async function renderHome(url = '/') {
  const SituationHome = (await import('@/features/map/SituationHome.jsx')).default;
  return render(<MemoryRouter initialEntries={[url]}><Loc /><SituationHome /></MemoryRouter>);
}
const search = () => screen.getByTestId('loc').textContent;
const rowOf = (name) => within(screen.getByRole('region', { name: 'Alerts' })).getByRole('button', { name: new RegExp(name) });

describe('map: Escape closes the open card', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); SITUATIONS = [A, B]; });

  it("closes the card, drops ?focus=, and focuses that situation's Alerts row", async () => {
    await renderHome();
    const row = rowOf('Mexico');
    row.focus();
    fireEvent.click(row);
    expect(search()).toContain('focus=');
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(search()).not.toContain('focus=');
    expect(document.activeElement).toBe(rowOf('Mexico'));
    expect(rowOf('Mexico')).toHaveAttribute('aria-pressed', 'false');
  });

  it('falls back to the first Alerts row when the card has no row (deep link to an unlisted id)', async () => {
    await renderHome('/?focus=news%23gone');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(search()).not.toContain('focus=');
    expect(document.activeElement).toBe(rowOf('Sudan'));
  });

  it('Escape inside a text field does not close the card', async () => {
    await renderHome();
    fireEvent.click(rowOf('Sudan'));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(search()).toContain('focus=');
    input.remove();
  });

  it('Escape already handled (defaultPrevented) does not close the card', async () => {
    await renderHome();
    fireEvent.click(rowOf('Sudan'));
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    ev.preventDefault();
    document.body.dispatchEvent(ev);
    expect(search()).toContain('focus=');
  });

  it('Escape with no card open changes nothing', async () => {
    await renderHome();
    const before = document.activeElement;
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(search()).toBe('');
    expect(document.activeElement).toBe(before);
  });
});
