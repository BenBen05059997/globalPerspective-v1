import { describe, it, expect } from 'vitest';
import { addSection, clearSections, toggleView, nextFocusId } from '../deckStack.js';

describe('deckStack', () => {
  it('addSection appends without mutating the input', () => {
    const a = [{ id: 1 }];
    const b = addSection(a, { id: 2 });
    expect(a).toEqual([{ id: 1 }]);
    expect(b).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('addSection handles a non-array starting state', () => {
    expect(addSection(null, { id: 1 })).toEqual([{ id: 1 }]);
  });

  it('clearSections returns an empty array', () => {
    expect(clearSections()).toEqual([]);
  });

  it('toggleView flips between deck and board', () => {
    expect(toggleView('deck')).toBe('board');
    expect(toggleView('board')).toBe('deck');
  });

  it('nextFocusId always points at the newest section', () => {
    expect(nextFocusId([{ id: 'a' }, { id: 'b' }])).toBe('b');
    expect(nextFocusId([])).toBeNull();
  });
});
