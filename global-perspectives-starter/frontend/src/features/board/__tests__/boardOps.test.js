import { describe, it, expect } from 'vitest';
import { PIN_BUDGET } from '@/shared/lib/board.js';
import { placeLabels, addPin, removePin, keepString, cutString, restoreString, layoutPins, missingActors, nextPinId } from '@/features/board/lib/boardOps.js';

const pin = (i, kind = 'thread', refId = `thread-${i}`) => ({ pinId: `p${String(i).padStart(2, '0')}`, kind, refId, addedAt: '2026-10-20T00:00:00Z' });
const empty = () => ({ boardId: 'b1', name: 'Test', pins: [], strings: [] });
const withPins = (n) => ({ ...empty(), pins: Array.from({ length: n }, (_, i) => pin(i + 1)) });

describe('addPin', () => {
  it('adds a pin with the next free id', () => {
    const r = addPin(withPins(2), { kind: 'country', refId: 'IRN' });
    expect(r.status).toBe('added');
    expect(r.pin.pinId).toBe('p03');
  });
  it('blocks the 13th pin', () => {
    const board = withPins(PIN_BUDGET);
    const r = addPin(board, { kind: 'thread', refId: 'thread-new' });
    expect(r.status).toBe('full');
    expect(r.board).toBe(board);
  });
  it('does not add the same pin twice (actor names compare case-insensitively)', () => {
    const board = { ...empty(), pins: [pin(1, 'actor', 'Iran')] };
    expect(addPin(board, { kind: 'actor', refId: ' iran ' }).status).toBe('duplicate');
  });
  it('reuses a freed id', () => {
    expect(nextPinId([pin(1), pin(3)])).toBe('p02');
  });
});

describe('strings', () => {
  const base = { ...withPins(3), strings: [{ a: 'p01', b: 'p02', owner: 'ours', strength: 'inferred' }] };
  it('keep adds a yours string, ordered a < b, with the line trimmed to 280', () => {
    const next = keepString(base, 'p03', 'p01', `  ${'x'.repeat(300)} `, '2026-10-20T01:00:00Z');
    const s = next.strings.find((x) => x.owner === 'yours');
    expect(s).toMatchObject({ a: 'p01', b: 'p03', keptAt: '2026-10-20T01:00:00Z' });
    expect(s.line).toHaveLength(280);
  });
  it('keep without a line stores no line', () => {
    expect(keepString(base, 'p02', 'p03', '  ').strings.find((x) => x.owner === 'yours').line).toBeUndefined();
  });
  it('keep on a pair that already has a string replaces it (one string per pair)', () => {
    const next = keepString(base, 'p02', 'p01', 'mine');
    expect(next.strings).toHaveLength(1);
    expect(next.strings[0].owner).toBe('yours');
  });
  it('cut sets cutAt and deletes nothing; restore clears it', () => {
    const cut = cutString(base, 'p02', 'p01', '2026-10-20T02:00:00Z');
    expect(cut.strings).toHaveLength(1);
    expect(cut.strings[0].cutAt).toBe('2026-10-20T02:00:00Z');
    expect(restoreString(cut, 'p01', 'p02').strings[0].cutAt).toBeUndefined();
  });
  it('removing a pin removes the strings that touched it', () => {
    expect(removePin(base, 'p01').strings).toEqual([]);
  });
});

describe('layoutPins', () => {
  it('is deterministic and independent of input order', () => {
    const pins = [pin(2), pin(1, 'country', 'IRN'), pin(3, 'actor', 'Iran')];
    expect(layoutPins(pins, 900, 620)).toEqual(layoutPins([...pins].reverse(), 900, 620));
  });
  it('puts one pin in the centre and gives every pin its own point', () => {
    expect(layoutPins([pin(1)], 900, 620)).toEqual({ p01: { x: 450, y: 310 } });
    const spots = Object.values(layoutPins(withPins(12).pins, 900, 620)).map((p) => `${p.x},${p.y}`);
    expect(new Set(spots).size).toBe(12);
  });
  it('keeps every centre a margin away from the edges', () => {
    const at = Object.values(layoutPins(withPins(12).pins, 900, 620, [], { x: 100, y: 70 }));
    expect(at.every((p) => p.x >= 100 && p.x <= 800 && p.y >= 70 && p.y <= 550)).toBe(true);
  });
});

describe('placeLabels', () => {
  const full = { w: 100, h: 40 };
  const small = { w: 60, h: 20 };
  it('puts a label at the string midpoint when nothing is in the way', () => {
    expect(placeLabels([{ id: 's', a: { x: 100, y: 200 }, b: { x: 500, y: 200 } }], [], 800, 400, full, small)).toEqual({ s: { x: 300, y: 200, small: false } });
  });
  it('slides off a card that covers the midpoint', () => {
    const out = placeLabels([{ id: 's', a: { x: 100, y: 200 }, b: { x: 500, y: 200 } }], [{ x: 300, y: 200, w: 120, h: 80 }], 800, 400, full, small);
    expect(Math.abs(out.s.x - 300) >= 110 || Math.abs(out.s.y - 200) >= 60).toBe(true);
    expect(out.s.small).toBe(false);
  });
  it('shrinks to the short tag when no full-size spot is free', () => {
    const items = [{ id: 'a', a: { x: 100, y: 50 }, b: { x: 140, y: 50 } }, { id: 'b', a: { x: 100, y: 50 }, b: { x: 140, y: 50 } }];
    const out = placeLabels(items, [], 240, 100, full, small);
    expect(out.a.small || out.b.small).toBe(true);
  });
  it('with dropBlocked, leaves out a label that has no clear spot instead of stacking it on a card', () => {
    const wall = [{ x: 120, y: 50, w: 400, h: 200 }];
    const item = [{ id: 's', a: { x: 100, y: 50 }, b: { x: 140, y: 50 } }];
    expect(placeLabels(item, wall, 240, 100, full, small, { dropBlocked: true })).toEqual({});
    expect(placeLabels(item, wall, 240, 100, full, small).s.small).toBe(true); // the graph keeps its short tag
  });
});

describe('missingActors', () => {
  const board = { ...empty(), pins: [pin(1), pin(2), pin(3)] };
  const result = (a, b, actors) => ({ a: { kind: 'thread', refId: a }, b: { kind: 'thread', refId: b }, grounds: [{ kind: 'actor', detail: actors }] });
  it('lists shared actors you do not follow, with the pins they sit on', () => {
    const out = missingActors(board, [result('thread-1', 'thread-2', ['iran']), result('thread-2', 'thread-3', ['iran', 'oman'])], ['Oman']);
    expect(out).toEqual([{ name: 'iran', pins: ['p01', 'p02', 'p03'] }]);
  });
  it('is empty with no connect results', () => {
    expect(missingActors(board, [], [])).toEqual([]);
  });
});
