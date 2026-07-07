/**
 * CountryWhatChanged — scoring-model-v2 per-axis drift in the "What changed" band.
 * The masking case: the blended scalar stays flat (conflict 80 is the max both days),
 * but the economic axis surges 30→72 — the band must surface and NAME that dimension.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CountryWhatChanged from '../components/atoms/CountryWhatChanged.jsx';

const MASKED_AXIS = [
  { dateKey: '2026-06-01', riskLevel: 'high', riskScore: 80, trajectory: '', headline: '', dimensions: { conflict: 80, economic: 30 } },
  { dateKey: '2026-06-02', riskLevel: 'high', riskScore: 80, trajectory: '', headline: '', dimensions: { conflict: 80, economic: 72 } },
];

function mount(snapshots) {
  return render(
    <MemoryRouter>
      <CountryWhatChanged snapshots={snapshots} />
    </MemoryRouter>
  );
}

describe('CountryWhatChanged — per-axis drift', () => {
  it('surfaces an axis move the flat scalar hid, naming the dimension + signed delta', () => {
    const { container } = mount(MASKED_AXIS);
    // The band renders at all (pre-v2 a flat 80→80 scalar returned null → nothing).
    expect(screen.getByText('What changed')).toBeInTheDocument();
    const pill = container.querySelector('.cwc-dim-axis');
    expect(pill).toBeTruthy();
    expect(pill.textContent.replace(/\s+/g, ' ')).toMatch(/Economic: 30 → 72 \(\+42\)/);
    // The scalar didn't move ≥8, so no "Risk score" dim competes with it.
    expect(container.textContent).not.toMatch(/Risk score/);
  });

  it('renders nothing when neither the scalar nor any axis moved (honest-empty)', () => {
    const { container } = mount([
      { dateKey: '2026-06-01', riskLevel: 'high', riskScore: 80, trajectory: '', headline: '', dimensions: { conflict: 80, economic: 30 } },
      { dateKey: '2026-06-02', riskLevel: 'high', riskScore: 80, trajectory: '', headline: '', dimensions: { conflict: 80, economic: 33 } },
    ]);
    expect(container.firstChild).toBeNull();
  });
});
