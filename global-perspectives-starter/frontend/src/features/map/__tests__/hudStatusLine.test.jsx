// HudStatusLine (F2.19, review R2): one consistent honesty line — "ANALYSIS PAUSED SINCE <date>
// · LAST STORIES <date> · DISASTER ALERTS LIVE" — with the stories/GDACS parts only appearing
// when the caller actually knows them (never a standing claim independent of the data).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HudStatusLine from '@/features/map/components/HudStatusLine.jsx';

describe('HudStatusLine', () => {
  it('renders nothing when analysis is not paused', () => {
    render(<HudStatusLine paused={null} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows only the paused clause when stories/GDACS are unknown (site-wide Layout usage)', () => {
    render(<HudStatusLine paused={{ label: 'Sep 12', text: 'analysis paused since Sep 12', beyondLookback: false }} />);
    expect(screen.getByText('ANALYSIS PAUSED SINCE Sep 12')).toBeInTheDocument();
  });

  it('adds LAST STORIES and DISASTER ALERTS LIVE when both are known (map usage)', () => {
    render(
      <HudStatusLine
        paused={{ label: 'Sep 12', text: 'analysis paused since Sep 12', beyondLookback: false }}
        storiesAsOf="2026-09-13T10:00:00.000Z"
        gdacsFresh
      />
    );
    const storiesLabel = new Date('2026-09-13T10:00:00.000Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    expect(screen.getByText(`ANALYSIS PAUSED SINCE Sep 12 · LAST STORIES ${storiesLabel} · DISASTER ALERTS LIVE`)).toBeInTheDocument();
  });

  it('omits DISASTER ALERTS LIVE when GDACS is not fresh', () => {
    render(<HudStatusLine paused={{ label: 'Sep 12', text: 'x', beyondLookback: false }} storiesAsOf="2026-09-13T10:00:00.000Z" gdacsFresh={false} />);
    expect(screen.queryByText(/DISASTER ALERTS/)).not.toBeInTheDocument();
  });

  it('shows the beyond-lookback clause uppercased when nothing was found in the search window', () => {
    render(<HudStatusLine paused={{ label: null, text: 'no analysis in the last 30 days', beyondLookback: true }} />);
    expect(screen.getByText('ANALYSIS PAUSED · NO ANALYSIS IN THE LAST 30 DAYS')).toBeInTheDocument();
  });
});
