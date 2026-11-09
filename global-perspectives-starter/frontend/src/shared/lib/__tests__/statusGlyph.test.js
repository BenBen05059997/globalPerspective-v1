import { describe, it, expect } from 'vitest';
import { statusGlyph } from '@/shared/lib/statusGlyph.js';

describe('status glyph from tracker fields', () => {
  it('▲ escalating from the escalating flag or state', () => {
    expect(statusGlyph({ state: 'peak', escalating: true }).glyph).toBe('▲');
    expect(statusGlyph({ state: 'escalating' }).key).toBe('escalating');
  });
  it('● new = emerging, ▼ cooling, ◆ steady = peak', () => {
    expect(statusGlyph({ state: 'emerging' }).glyph).toBe('●');
    expect(statusGlyph({ state: 'cooling' }).glyph).toBe('▼');
    expect(statusGlyph({ state: 'peak' }).glyph).toBe('◆');
  });
  it('escalating wins over the state word; closed/unknown get no badge', () => {
    expect(statusGlyph({ state: 'cooling', escalating: true }).glyph).toBe('▲');
    expect(statusGlyph({ state: 'closed', escalating: true })).toBeNull();
    expect(statusGlyph({ state: 'whatever' })).toBeNull();
    expect(statusGlyph(null)).toBeNull();
  });
});
