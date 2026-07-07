/**
 * RiskScorecard — scoring-model-v2 Phase C dimension breakdown.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RiskScorecard from '../components/atoms/RiskScorecard.jsx';

// Japan from the Phase-0 spike: economy is the story, humanitarian is silent.
const JAPAN = {
  dimensions: {
    conflict: { score: 55, why: 'Chinese-Russian bomber patrols near the Sea of Japan' },
    political: { score: 30, why: 'Supreme Court upheld the Unification Church dissolution' },
    economic: { score: 72, why: 'Yen at a 40-year low; bankruptcies at their highest since 2022' },
    humanitarian: null,
  },
};

describe('RiskScorecard', () => {
  it('leads with the worst axis and shows its grounding', () => {
    render(<RiskScorecard record={JAPAN} />);
    // headline = ELEVATED · Economic 72 (max axis, not an average of 52)
    expect(screen.getByText(/ELEVATED · Economic 72/)).toBeInTheDocument();
    expect(screen.getByText(/40-year low/)).toBeInTheDocument();
    // the lead axis is tagged
    expect(screen.getByText('lead')).toBeInTheDocument();
  });

  it('renders a null axis as "no signal", not 0 (sparsity is visible)', () => {
    render(<RiskScorecard record={JAPAN} />);
    expect(screen.getByText('no signal')).toBeInTheDocument();
    // the four axis labels are all present
    for (const label of ['Conflict', 'Political', 'Economic', 'Humanitarian']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('surfaces the breadth flag only when >=3 axes are elevated', () => {
    const { rerender, container } = render(<RiskScorecard record={JAPAN} />);
    expect(container.querySelector('.riskcard-breadth')).toBeNull(); // Japan: only economic >=50

    const HOT = { dimensions: { conflict: 85, political: 60, economic: 55, humanitarian: 70 } };
    rerender(<RiskScorecard record={HOT} />);
    expect(screen.getByText('4/4 axes elevated')).toBeInTheDocument();
  });

  it('renders nothing for a scalar-only (pre-v2) record', () => {
    const { container } = render(<RiskScorecard record={{ riskScore: 62, riskLevel: 'elevated' }} />);
    expect(container.firstChild).toBeNull();
  });
});
