/**
 * Smoke render tests for the Analysis Studio ```gp-struct``` visual atoms
 * (components/atoms/AnalysisVisuals.jsx). See ANALYSIS_PRO_STRUCTURE_PLAN.md §P2.4.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { ScenarioBars, IndicatorMatrix, RippleTable } from '../components/atoms/AnalysisVisuals.jsx';

describe('ScenarioBars', () => {
  it('renders one row per scenario with name and range', () => {
    const { container } = render(
      <ScenarioBars scenarios={[{ name: 'Holds', pLow: 55, pHigh: 65 }, { name: 'Collapse', pLow: 20, pHigh: 45 }]} />
    );
    const rows = container.querySelectorAll('.av-sbar-row');
    expect(rows).toHaveLength(2);
    expect(container.textContent).toContain('Holds');
    expect(container.textContent).toContain('55–65%');
  });

  it('renders nothing for an empty array', () => {
    const { container } = render(<ScenarioBars scenarios={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for null/undefined input', () => {
    const { container } = render(<ScenarioBars scenarios={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('IndicatorMatrix', () => {
  it('renders a table row per indicator with confirms/kills', () => {
    const { container } = render(
      <IndicatorMatrix indicators={[{ signal: 'Talks resume', confirms: 'Holds', kills: 'Collapse' }]} />
    );
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.textContent).toContain('Talks resume');
    expect(container.textContent).toContain('Holds');
    expect(container.textContent).toContain('Collapse');
  });

  it('shows an em dash when kills is empty', () => {
    const { container } = render(
      <IndicatorMatrix indicators={[{ signal: 'Talks resume', confirms: 'Holds', kills: '' }]} />
    );
    expect(container.querySelector('.av-ikill').textContent).toBe('—');
  });

  it('renders nothing for an empty array', () => {
    const { container } = render(<IndicatorMatrix indicators={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('RippleTable', () => {
  it('renders a row per ripple with direction glyph and magnitude dots', () => {
    const { container } = render(
      <RippleTable ripples={[{ instrument: 'Brent crude', direction: 'up', magnitude: 'moderate' }]} />
    );
    expect(container.textContent).toContain('Brent crude');
    expect(container.querySelector('.av-rdir-up')).toBeTruthy();
    expect(container.textContent).toContain('●●');
  });

  it('renders nothing for missing input', () => {
    const { container } = render(<RippleTable ripples={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
