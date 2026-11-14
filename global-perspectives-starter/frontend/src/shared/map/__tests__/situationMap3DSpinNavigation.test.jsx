// The idle spin commits camera state ~30x/s; once the URL leaves the page the map mounted on it must
// stop, or those commits starve React Router's navigation and the map stays on screen.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const deck = { props: null };
vi.mock('@deck.gl/react', () => ({ default: (props) => { deck.props = props; return null; } }));
vi.mock('@deck.gl/core', () => ({
  LayerExtension: class {}, FlyToInterpolator: class {}, _GlobeView: class {}, _GlobeController: class {},
}));
vi.mock('@deck.gl/layers', () => {
  const L = class { constructor(p) { this.props = p; } };
  return { GeoJsonLayer: L, ScatterplotLayer: L, ArcLayer: L, BitmapLayer: L, PathLayer: L, IconLayer: L };
});

import SituationMap3D from '@/shared/map/SituationMap3D.jsx';

afterEach(() => { vi.useRealTimers(); window.history.pushState({}, '', '/'); });

describe('SituationMap3D idle spin', () => {
  it('stops committing once the URL leaves the mounted page', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    window.history.pushState({}, '', '/map');
    render(<SituationMap3D situations={[]} spinOn height={300} width={400} />);
    const frames = (n) => act(() => { for (let i = 0; i < n; i++) vi.advanceTimersByTime(34); });
    frames(3); // first frame only records a start time
    const spinning = deck.props.viewState.longitude;
    frames(10);
    expect(deck.props.viewState.longitude).not.toBe(spinning);

    window.history.pushState({}, '', '/weekly');
    frames(1);
    const stopped = deck.props.viewState.longitude;
    frames(20);
    expect(deck.props.viewState.longitude).toBe(stopped);
  });
});
