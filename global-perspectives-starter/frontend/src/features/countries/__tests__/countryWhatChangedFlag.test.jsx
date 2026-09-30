// D9 (Batch 3 / E): a direction-flagged drift note never shows its contradictory explanation or its
// cited event as the cause; the numbers stay. The real Iran 2026-08-19 note is the fixture.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CountryWhatChanged from '@/features/countries/components/CountryWhatChanged.jsx';

const SNAPS = [
  { dateKey: '2026-08-18', riskLevel: 'high', riskScore: 90, trajectory: '', headline: '', dimensions: { economic: 80, humanitarian: 90, conflict: 90 } },
  { dateKey: '2026-08-19', riskLevel: 'high', riskScore: 90, trajectory: '', headline: '', dimensions: { economic: 90, humanitarian: 70, conflict: 90 } },
];
const NOTE = {
  asOf: '2026-08-19',
  changeDimensions: { economic: { from: 80, to: 90, delta: 10 }, humanitarian: { from: 90, to: 70, delta: -20 } },
  triggerEvent: { topicId: 't', title: 'UAE announces indefinite trade embargo on Iran', date: '2026-08-19' },
  whyChanged: 'The embargo directly escalates economic isolation, driving the economic score up from 80 to 90. This action also shifts the humanitarian score down as trade disruption worsens civilian conditions.',
};
const mount = (notes) => render(<MemoryRouter><CountryWhatChanged snapshots={SNAPS} driftNotes={notes} /></MemoryRouter>);

describe('CountryWhatChanged with a direction-flagged note', () => {
  it('an unflagged note shows its explanation and cited event (unchanged behaviour)', () => {
    const { container } = mount([NOTE]);
    expect(container.textContent).toMatch(/Because:.*UAE announces indefinite trade embargo/);
    expect(container.textContent).toMatch(/worsens civilian conditions/);
  });
  it('a flagged note shows the numbers only: no contradictory prose, no cited event', () => {
    const { container } = mount([{ ...NOTE, directionFlag: { backfilled: true, at: '2026-09-30T00:00:00Z' } }]);
    expect(container.textContent).not.toMatch(/worsens civilian conditions/);
    expect(container.textContent).not.toMatch(/UAE announces/);
    expect(container.textContent).toMatch(/Humanitarian risk fell 20 points \(90 to 70\)/);
    expect(container.textContent).toMatch(/Economic risk rose 10 points \(80 to 90\)/);
  });
});
