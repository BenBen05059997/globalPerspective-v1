// A burst of focus changes must end on the last target: a frame of an older fly-to that lands after
// the new target is set but before React commits it must not overwrite it (it has no transition, so
// deck.gl would cancel the new flight).
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';

// `landBetween` runs once inside the DeckGL render that first carries the new target (longitude 70):
// the focus effect has already written it to the view-state ref but React has not finished
// committing it, which is where a late frame of the previous flight arrives in the browser.
const deck = { props: null, landBetween: null };
vi.mock('@deck.gl/react', () => ({
  default: (props) => {
    deck.props = props;
    if (deck.landBetween && props.viewState.longitude === 70) { const f = deck.landBetween; deck.landBetween = null; f(props); }
    return null;
  },
}));
vi.mock('@deck.gl/core', () => ({
  LayerExtension: class {}, FlyToInterpolator: class {}, _GlobeView: class {}, _GlobeController: class {},
}));
vi.mock('@deck.gl/layers', () => {
  const L = class { constructor(p) { this.props = p; } };
  return { GeoJsonLayer: L, ScatterplotLayer: L, ArcLayer: L, BitmapLayer: L, PathLayer: L, IconLayer: L };
});

import SituationMap3D from '@/shared/map/SituationMap3D.jsx';

const sit = (id, lon, lat) => ({ id, verb_label: id, centroid: { lon, lat }, tier: 'high', state: 'peak', axis: 'conflict', iso3_affected: [] });
const SITS = [sit('a', 10, 20), sit('b', 70, -30)];
const mount = (focusId) => <SituationMap3D situations={SITS} focusId={focusId} height={300} width={400} />;
// a deck.gl frame: the in-between camera, with no transition fields
const frame = (over, ix = { inTransition: true }) => ({
  viewState: { ...deck.props.viewState, transitionDuration: undefined, transitionInterpolator: undefined, ...over }, interactionState: ix,
});

describe('SituationMap3D fly-to', () => {
  it('focus A, frame for A, focus B before commit, stale A frame: the view ends on B with its transition', () => {
    const { rerender } = render(mount(null));
    rerender(mount('a'));
    expect(deck.props.viewState.longitude).toBe(10);
    act(() => { deck.props.onViewStateChange(frame({ longitude: 5 })); });
    expect(deck.props.viewState.longitude).toBe(5);
    const staleA = frame({ longitude: 6 });
    const onChange = deck.props.onViewStateChange;
    deck.landBetween = () => onChange(staleA);
    vi.spyOn(console, 'error').mockImplementation(() => {}); // an unguarded frame would setState during render
    rerender(mount('b'));
    rerender(mount('b')); // render again: the camera comes from the ref, so this shows where it really is
    expect(deck.props.viewState.longitude).toBe(70);
    expect(deck.props.viewState.transitionInterpolator).toBeTruthy();
    expect(deck.props.viewState.transitionDuration).toBeGreaterThan(0);
  });

  it('frames of the current flight keep moving the camera once its target is committed', () => {
    const { rerender } = render(mount(null));
    rerender(mount('b'));
    act(() => { deck.props.onViewStateChange(frame({ longitude: 40 })); });
    expect(deck.props.viewState.longitude).toBe(40);
  });

  it('a user drag still updates the view', () => {
    const { rerender } = render(mount(null));
    rerender(mount('a'));
    act(() => { deck.props.onViewStateChange(frame({ longitude: 33 }, { isDragging: true })); });
    expect(deck.props.viewState.longitude).toBe(33);
    expect(deck.props.viewState.transitionInterpolator).toBeFalsy();
  });

  it('a user drag before the new target commits still wins over the flight', () => {
    const { rerender } = render(mount(null));
    rerender(mount('a'));
    const onChange = deck.props.onViewStateChange;
    deck.landBetween = () => onChange(frame({ longitude: 44 }, { isDragging: true }));
    vi.spyOn(console, 'error').mockImplementation(() => {}); // setState during DeckGL's render
    rerender(mount('b'));
    rerender(mount('b')); // the component renders from its ref, so the next render shows where the camera really is
    expect(deck.props.viewState.longitude).toBe(44);
  });
});
