// The radar map draws judged links as dashed lines (strong long, medium short) only when given arcs;
// the Key explains them (dimmed when none are on the map).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RadarMap from '@/features/map/components/RadarMap.jsx';
import MapLegend from '@/features/map/components/MapLegend.jsx';

const base = { situations: [], focusId: null, callout: null, newIds: null, height: 300, onSelect() {}, onOpenCallout() {}, onScan() {}, shading: [], countryRisk: [], onSelectCountry() {} };

describe('RadarMap link lines', () => {
  it('no arcs, no lines', () => {
    const { container } = render(<MemoryRouter><RadarMap {...base} linkArcs={[]} /></MemoryRouter>);
    expect(container.querySelectorAll('.rd-link').length).toBe(0);
  });
  it('a strong and a medium arc: one dashed path each with different dash patterns', () => {
    const arcs = [{ fromIso3: 'IRN', toIso3: 'SAU', confidence: 'strong' }, { fromIso3: 'IRN', toIso3: 'JPN', confidence: 'medium' }];
    const { container } = render(<MemoryRouter><RadarMap {...base} linkArcs={arcs} /></MemoryRouter>);
    const strong = container.querySelector('.rd-link-strong');
    const medium = container.querySelector('.rd-link-medium');
    expect(strong).toBeTruthy(); expect(medium).toBeTruthy();
    expect(strong.getAttribute('stroke-dasharray')).not.toBe(medium.getAttribute('stroke-dasharray'));
    expect(Number(strong.getAttribute('stroke-width'))).toBeGreaterThan(Number(medium.getAttribute('stroke-width')));
  });
});

describe('MapLegend line row', () => {
  it('explains the lines and is dimmed when none are drawn', () => {
    const { container, rerender } = render(<MapLegend present={{}} onClose={() => {}} linksNow={0} />);
    expect(screen.getByText('Line = judged link')).toBeInTheDocument();
    expect(screen.getByText(/Strong · long dashes/)).toBeInTheDocument();
    expect(container.querySelector('.sh-leg-off')).toBeTruthy();
    rerender(<MapLegend present={{}} onClose={() => {}} linksNow={2} />);
    const strongItem = screen.getByText(/Strong · long dashes/).closest('.sh-leg');
    expect(strongItem.className).not.toMatch(/sh-leg-off/);
  });
});
