import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BoardMap from '@/features/board/components/BoardMap.jsx';
import MapRail from '@/features/board/components/MapRail.jsx';
import { placeOfPin, ringCentres, placeRingLabels, MAP_W, MAP_H } from '@/features/board/lib/mapPlaces.js';
import { mapPinLine } from '@/features/board/lib/graphText.js';

afterEach(cleanup);

const pins = [
  { pinId: 'p1', kind: 'thread', refId: 't1', iso3: ['IRN'] },
  { pinId: 'p2', kind: 'country', refId: 'USA' },
  { pinId: 'p3', kind: 'actor', refId: 'Iran' },
  { pinId: 'p4', kind: 'thread', refId: 't4' },
];
const info = { p1: { label: 'Ship attacks', risk: 88, category: 'conflict' }, p2: { label: 'United States', risk: 85, riskWas: 95 }, p3: { label: 'Iran' }, p4: { label: 'No country story' } };
const strings = [
  { a: 'p1', b: 'p2', owner: 'ours', strength: 'strong', mechanism: 'oil price' },
  { a: 'p1', b: 'p3', owner: 'ours', strength: 'weak', mechanism: 'actor' },
];

describe('map places', () => {
  it('places country and story pins, never an actor or a story with no country', () => {
    expect(placeOfPin(pins[0], undefined)).toHaveLength(2);
    expect(placeOfPin(pins[0], { iso3: ['USA'] })).not.toEqual(placeOfPin(pins[0], undefined)); // the story view wins
    expect(placeOfPin(pins[1])).toHaveLength(2);
    expect(placeOfPin(pins[2])).toBeNull();
    expect(placeOfPin(pins[3], { iso3: [] })).toBeNull();
  });
  it('fans pins on one spot apart and keeps labels on the map and apart', () => {
    const centres = ringCentres([{ pinId: 'a', at: [100, 100] }, { pinId: 'b', at: [100, 100] }]);
    expect(centres.a).not.toEqual(centres.b);
    const labels = placeRingLabels([{ pinId: 'a', text: 'First label' }, { pinId: 'b', text: 'Second label' }], centres, MAP_W, MAP_H);
    expect(Math.abs(labels.a.y - labels.b.y) >= 30 || Math.abs(labels.a.x - labels.b.x) >= 60).toBe(true);
  });
  it('words the pin line from the data it holds', () => {
    expect(mapPinLine(pins[0], info.p1)).toBe('HIGH 88 · conflict');
    expect(mapPinLine(pins[1], info.p2)).toBe('HIGH 85 · was 95');
    expect(mapPinLine(pins[2], info.p3)).toBe('');
  });
});

describe('BoardMap', () => {
  it('draws placed pins and strings, parks the rest in chips, and opens a pin', () => {
    const onPickPin = vi.fn();
    const onAddGhost = vi.fn();
    render(<BoardMap pins={pins} strings={strings} info={info} ghosts={[{ name: 'Oil price', pins: ['p1', 'p2'] }]} coverageGap={{ date: '2026-10-14', note: 'no archive' }} onPickPin={onPickPin} onPickString={() => {}} onAddGhost={onAddGhost} />);
    expect(screen.getAllByRole('button', { name: /^(Story|Country):/ })).toHaveLength(2);
    expect(document.querySelectorAll('.board-string').length).toBe(1); // p3 has no place: its string is only in the list
    expect(screen.getByText(/Sketch map/)).toBeTruthy();
    expect(screen.getByTestId('board-fog').textContent).toMatch(/No coverage 14 Oct/);
    expect(screen.getByRole('button', { name: /Suggested pin: Oil price/ })).toBeTruthy();
    expect(screen.getByText('Iran').closest('button').textContent).toMatch(/No place/);
    expect(screen.getByText('No country story').closest('button')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Story: Ship attacks/ }));
    expect(onPickPin).toHaveBeenCalledWith('p1');
    fireEvent.click(screen.getByRole('button', { name: /Suggested pin: Oil price/ }));
    expect(onAddGhost).toHaveBeenCalledWith('Oil price');
  });
});

describe('MapRail', () => {
  it('shows counts only when the board has record views, and the first gap', () => {
    const onOpen = vi.fn();
    const board = { recordAvailable: true, pins: [{ pinId: 'p1', lastMoved: new Date().toISOString() }], strings: [] };
    render(<MapRail board={board} stories={{}} links={{}} missing={[{ name: 'Oil price' }]} onOpen={onOpen} />);
    expect(screen.getByLabelText('1 pins moved')).toBeTruthy();
    expect(screen.getByText('1 gap · Oil price')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Expand this week/ }));
    expect(onOpen).toHaveBeenCalled();
    cleanup();
    render(<MapRail board={{ ...board, recordAvailable: false }} stories={{}} links={{}} missing={[]} onOpen={onOpen} />);
    expect(screen.queryByLabelText(/pins moved/)).toBeNull();
  });
});
