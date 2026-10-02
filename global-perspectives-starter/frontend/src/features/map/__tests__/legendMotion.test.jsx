// Key panel, Motion row: the budget text is built from the same constants the maps use
// (lib/pulse.js MOTION_BUDGET), so the number on screen is the number in the code.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MapLegend from '@/features/map/components/MapLegend.jsx';
import { MOTION_BUDGET, pulseSet } from '@/features/map/lib/pulse.js';

describe('Key — motion budget', () => {
  it('says "at most 3 moving, 8 pulsing" from MOTION_BUDGET', () => {
    expect(MOTION_BUDGET).toEqual({ movers: 3, pulses: 8 });
    render(<MapLegend present={{}} />);
    expect(screen.getByText(/at most 3 moving, 8 pulsing/)).toBeInTheDocument();
  });
  it('the pulse cap defaults to the budget', () => {
    const now = Date.parse('2026-10-02T12:00:00Z');
    const sits = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, tier: 'high', opened_at: new Date(now - 3600 * 1000).toISOString() }));
    expect(pulseSet(sits, now).size).toBe(MOTION_BUDGET.pulses);
  });
});
