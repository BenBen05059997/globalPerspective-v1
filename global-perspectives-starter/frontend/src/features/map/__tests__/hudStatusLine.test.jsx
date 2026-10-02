// HudStatusLine: one consistent honesty line, site-wide and on the map — "New stories and analysis
// paused since <date> · disaster alerts live". The GDACS clause is computed (live / last checked /
// nothing when unknown); the line never renders when not paused.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HudStatusLine, { statusLineText } from '@/features/map/components/HudStatusLine.jsx';
import { gdacsStatus, GDACS_FRESH_MS } from '@/features/map/lib/gdacsStatus.js';

const PAUSED = { label: 'Oct 1', text: 'analysis paused since Oct 1', beyondLookback: false };

describe('HudStatusLine', () => {
  it('renders nothing when analysis is not paused', () => {
    render(<HudStatusLine paused={null} gdacs={{ state: 'live', checkedAt: new Date() }} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(statusLineText(null, { state: 'live' })).toBeNull();
  });

  it('says only the paused clause when GDACS is unknown', () => {
    render(<HudStatusLine paused={PAUSED} gdacs={{ state: 'unknown', checkedAt: null }} />);
    expect(screen.getByText('New stories and analysis paused since Oct 1')).toBeInTheDocument();
  });

  it('adds "disaster alerts live" only when GDACS is live', () => {
    render(<HudStatusLine paused={PAUSED} gdacs={{ state: 'live', checkedAt: new Date() }} />);
    expect(screen.getByText('New stories and analysis paused since Oct 1 · disaster alerts live')).toBeInTheDocument();
  });

  it('says honestly when GDACS is stale: last checked <date>, never "live"', () => {
    const checked = new Date('2026-09-20T10:00:00Z');
    const label = checked.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const text = statusLineText(PAUSED, { state: 'stale', checkedAt: checked });
    expect(text).toBe(`New stories and analysis paused since Oct 1 · disaster alerts last checked ${label}`);
    expect(text).not.toMatch(/live/);
  });

  it('shows the beyond-lookback clause when nothing was found in the search window', () => {
    render(<HudStatusLine paused={{ label: null, text: 'no analysis in the last 30 days', beyondLookback: true }} />);
    expect(screen.getByText('New stories and analysis paused · no analysis in the last 30 days')).toBeInTheDocument();
  });
});

describe('gdacsStatus', () => {
  const now = Date.parse('2026-10-02T12:00:00Z');
  it('live within 2h, stale after, unknown without a stamp or with a future one', () => {
    expect(gdacsStatus({ sources: { gdacs: new Date(now - 60 * 60 * 1000).toISOString() } }, now).state).toBe('live');
    expect(gdacsStatus({ sources: { gdacs: new Date(now - GDACS_FRESH_MS - 1000).toISOString() } }, now).state).toBe('stale');
    expect(gdacsStatus({ sources: {} }, now).state).toBe('unknown');
    expect(gdacsStatus(null, now).state).toBe('unknown');
    expect(gdacsStatus({ sources: { gdacs: new Date(now + 3600000).toISOString() } }, now).state).toBe('unknown');
  });
});
