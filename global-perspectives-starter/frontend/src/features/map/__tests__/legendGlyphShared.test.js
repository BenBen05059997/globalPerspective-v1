import { describe, it, expect } from 'vitest';
import * as legend from '@/features/map/lib/legend.js';
import { statusGlyph, STATUS_GLYPHS } from '@/shared/lib/statusGlyph.js';

describe('legend glyph vocabulary moved to shared', () => {
  it('the map legend re-exports the same helpers', () => {
    expect(legend.statusGlyph).toBe(statusGlyph);
    expect(legend.STATUS_GLYPHS).toBe(STATUS_GLYPHS);
    expect(legend.statusGlyph({ escalating: true }).glyph).toBe('▲');
    expect(legend.statusGlyph({ state: 'closed' })).toBeNull();
  });
});
