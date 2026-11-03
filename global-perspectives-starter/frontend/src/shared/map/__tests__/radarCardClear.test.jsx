// A beam-pass card must not outlive its situations: switching to the Country risk layer (which hands the
// radar no situations) clears it at once instead of leaving it up for its remaining seconds.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import RadarMap from '@/shared/map/RadarMap.jsx';

const recent = new Date().toISOString();
const SIT = [{
  id: 'a', source: 'news', verb_label: 'Strikes hit the port', axis: 'conflict', tier: 'high', state: 'peak', escalating: false,
  centroid: { lat: 30, lon: 50 }, iso3_affected: ['IRN'], affected_names: [], opened_at: recent, last_change_at: recent,
}];
const base = { focusId: null, newIds: null, height: 300, onSelect() {}, onScan() {}, shading: [], linkArcs: [], countryRisk: [], onSelectCountry() {} };

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('RadarMap beam-pass card', () => {
  it('is cleared when the situations go away', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let t = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(() => { t += 90; cb(t); }, 0));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => clearTimeout(id));
    // a marker needs a box for the card to be placed beside it
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 110, top: 100, bottom: 110, width: 10, height: 10 });
    const { container, rerender } = render(<MemoryRouter><RadarMap {...base} situations={SIT} /></MemoryRouter>);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(container.querySelector('.rd-card')).toBeTruthy();
    rerender(<MemoryRouter><RadarMap {...base} situations={[]} /></MemoryRouter>);
    expect(container.querySelector('.rd-card')).toBeNull();
  });
});
