/**
 * Atom-level tests for the economic disruption layer.
 * See ECONOMIC_VERIFICATION_PLAN.md §8.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SeverityBadge from '../components/atoms/SeverityBadge.jsx';
import MechanismCard from '../components/atoms/MechanismCard.jsx';
import DisruptionRow from '../components/atoms/DisruptionRow.jsx';
import DisruptionPreview from '../components/atoms/DisruptionPreview.jsx';
import QualityFlag from '../components/atoms/QualityFlag.jsx';

const router = (ui) => <MemoryRouter>{ui}</MemoryRouter>;

const FULL_IMPACT = {
  scope: 'thread',
  scopeId: 'thread-iran-x1',
  hasImpact: true,
  headline: 'Iran-Israel tensions push Brent +4%',
  severity: 'severe',
  severityScore: 78,
  confidence: 'high',
  horizon: 'days',
  instruments: [
    { instrumentId: 'BRENT', direction: 'up', magnitude: 'large', rationale: 'supply risk', citedTopicIds: ['topic-abc'] },
    { instrumentId: 'GOLD', direction: 'up', magnitude: 'moderate', rationale: 'haven bid', citedTopicIds: ['topic-abc'] },
    { instrumentId: 'VIX', direction: 'up', magnitude: 'moderate', rationale: 'risk-off', citedTopicIds: ['topic-abc'] },
    { instrumentId: 'USD/JPY', direction: 'down', magnitude: 'small', rationale: 'yen haven', citedTopicIds: ['topic-abc'] },
  ],
  winners: [
    { name: 'Saudi Arabia', type: 'country', why: 'spare capacity' },
    { name: 'United States', type: 'country', why: 'shale exporter' },
  ],
  losers: [
    { name: 'Japan', type: 'country', why: 'oil import dependence' },
    { name: 'EU airlines', type: 'sector', why: 'jet fuel exposure' },
  ],
  mechanism: 'Strait of Hormuz transits ~21% of crude [topic-abc].',
  historicalAnalog: { event: 'Aramco attack', year: '2019', outcome: 'Brent +15% in days', caveat: 'Saudi spare capacity is lower today' },
  watchSignals: ['Tanker AIS rerouting', 'OPEC emergency call'],
  citedTopicIds: ['topic-abc'],
  generatedAt: new Date(Date.now() - 3600_000).toISOString(),
  marketContext: { BRENT: { value: 82.4, asOf: new Date().toISOString() } },
};

// ─── SeverityBadge ─────────────────────────────────────────────────────────

describe('SeverityBadge', () => {
  it('renders severe with score', () => {
    const { container } = render(<SeverityBadge level="severe" score={85} size="md" />);
    expect(container.textContent).toContain('SEVERE');
    expect(container.textContent).toContain('85');
    expect(container.querySelector('.sev-high')).toBeTruthy();
  });

  it('renders moderate without score in sm size', () => {
    const { container } = render(<SeverityBadge level="moderate" size="sm" />);
    expect(container.textContent).toContain('MODER');
    expect(container.querySelector('.sev-score')).toBeFalsy();
    expect(container.querySelector('.sev-elevated')).toBeTruthy();
    expect(container.querySelector('.sev-sm')).toBeTruthy();
  });

  it('renders minor', () => {
    const { container } = render(<SeverityBadge level="minor" score={20} />);
    expect(container.textContent).toContain('MINOR');
    expect(container.querySelector('.sev-low')).toBeTruthy();
  });

  it('falls back to elevated styling on garbage level', () => {
    const { container } = render(<SeverityBadge level="garbage" />);
    expect(container.querySelector('.sev-elevated')).toBeTruthy();
    expect(container.textContent).toContain('GARBAGE');
  });
});

// ─── MechanismCard ─────────────────────────────────────────────────────────

describe('MechanismCard', () => {
  it('renders all six sections for a full record', () => {
    const { container } = render(router(<MechanismCard impact={FULL_IMPACT} />));
    expect(container.querySelector('.mc-headline').textContent).toContain('Iran-Israel');
    expect(container.querySelector('.mc-instruments')).toBeTruthy();
    expect(container.textContent).toContain('Mechanism');
    expect(container.textContent).toContain('Winners');
    expect(container.textContent).toContain('Losers');
    expect(container.textContent).toContain('Historical analog');
    expect(container.textContent).toContain('Watch signals');
    expect(container.textContent).toContain('Not investment advice');
  });

  it('renders nothing for hasImpact:false', () => {
    const { container } = render(router(<MechanismCard impact={{ hasImpact: false }} />));
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for null impact', () => {
    const { container } = render(router(<MechanismCard impact={null} />));
    expect(container.firstChild).toBeNull();
  });

  it('hides winlose block when both lists are empty', () => {
    const impact = { ...FULL_IMPACT, winners: [], losers: [] };
    const { container } = render(router(<MechanismCard impact={impact} />));
    expect(container.querySelector('.mc-winlose')).toBeFalsy();
  });

  it('hides analog block when historicalAnalog is null', () => {
    const impact = { ...FULL_IMPACT, historicalAnalog: null };
    const { container } = render(router(<MechanismCard impact={impact} />));
    expect(container.querySelector('.mc-analog')).toBeFalsy();
  });

  it('hides watch block when watchSignals is empty', () => {
    const impact = { ...FULL_IMPACT, watchSignals: [] };
    const { container } = render(router(<MechanismCard impact={impact} />));
    expect(container.textContent).not.toContain('Watch signals');
  });

  it('links country winners but renders sectors as static text', () => {
    const { container } = render(router(<MechanismCard impact={FULL_IMPACT} />));
    const links = container.querySelectorAll('.mc-ent-link');
    expect(links.length).toBeGreaterThan(0);
    // EU airlines is type "sector" → should not be a link
    expect(container.querySelector('.mc-ent-static')).toBeTruthy();
  });
});

// ─── DisruptionRow ─────────────────────────────────────────────────────────

describe('DisruptionRow', () => {
  it('renders as a Link when scopeId present', () => {
    const { container } = render(router(<DisruptionRow disruption={FULL_IMPACT} />));
    const link = container.querySelector('a.drow-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('/weekly/thread/');
    expect(link.getAttribute('href')).toContain('tab=economy');
  });

  it('renders as div (no Link) when scopeId is missing', () => {
    const { container } = render(router(<DisruptionRow disruption={{ ...FULL_IMPACT, scopeId: null }} />));
    expect(container.querySelector('a.drow-link')).toBeFalsy();
    expect(container.querySelector('.drow')).toBeTruthy();
  });

  it('shows first 3 tickers + "+N more" when many instruments', () => {
    const many = {
      ...FULL_IMPACT,
      instruments: Array.from({ length: 8 }, (_, i) => ({
        instrumentId: `INS${i}`, direction: 'up', magnitude: 'moderate', citedTopicIds: ['topic-abc'],
      })),
    };
    const { container } = render(router(<DisruptionRow disruption={many} />));
    expect(container.textContent).toContain('+5 more');
  });

  it('renders nothing when hasImpact:false', () => {
    const { container } = render(router(<DisruptionRow disruption={{ hasImpact: false }} />));
    expect(container.firstChild).toBeNull();
  });
});

// ─── DisruptionPreview ─────────────────────────────────────────────────────

describe('DisruptionPreview', () => {
  it('renders headline, severity, top tickers', () => {
    const { container } = render(<DisruptionPreview impact={FULL_IMPACT} />);
    expect(container.textContent).toContain('Iran-Israel');
    expect(container.querySelector('.dprev-tick')).toBeTruthy();
  });

  it('fires onExpand callback on click', () => {
    const fn = vi.fn();
    render(<DisruptionPreview impact={FULL_IMPACT} onExpand={fn} />);
    fireEvent.click(screen.getByRole('button'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when hasImpact:false', () => {
    const { container } = render(<DisruptionPreview impact={{ hasImpact: false }} />);
    expect(container.firstChild).toBeNull();
  });
});

// ─── QualityFlag ──────────────────────────────────────────────────────────

describe('QualityFlag', () => {
  it('renders flag with tooltip when is_low_quality:true', () => {
    const impact = {
      ...FULL_IMPACT,
      is_low_quality: true,
      qualityScores: { coherence: 4, citation_fidelity: 2, analog_match: 1, severity_calibration: 3, no_bs: 4 },
      qualityReasons: { citation_fidelity: 'cites topics not in thread', analog_match: 'unrelated event' },
    };
    const { container } = render(<QualityFlag impact={impact} />);
    const el = container.querySelector('.qflag');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('auto-judged');
    const title = el.getAttribute('title');
    expect(title).toContain('Citations');
    expect(title).toContain('Analog match');
    expect(title).toContain('cites topics not in thread');
  });

  it('renders nothing when is_low_quality is undefined (judge not yet run)', () => {
    const { container } = render(<QualityFlag impact={FULL_IMPACT} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when is_low_quality:false', () => {
    const impact = { ...FULL_IMPACT, is_low_quality: false };
    const { container } = render(<QualityFlag impact={impact} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when impact is null', () => {
    const { container } = render(<QualityFlag impact={null} />);
    expect(container.firstChild).toBeNull();
  });
});
