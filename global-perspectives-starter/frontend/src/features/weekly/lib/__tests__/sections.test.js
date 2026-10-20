import { describe, it, expect } from 'vitest';
import { SECTIONS, LABELS, CONFIDENCE, orderedSections } from '@/features/weekly/lib/sections.js';

describe('weekly sections (mirrored from backend/weekly/sections.js)', () => {
  it('prints the six sections in order', () => {
    expect(SECTIONS.map((s) => s.key)).toEqual(['lead', 'moved', 'trace', 'dates', 'new', 'coverage']);
    expect(LABELS).toEqual({ fact: 'FACT', judgment: 'JUDGMENT' });
    expect(CONFIDENCE).toEqual(['low', 'medium', 'high']);
  });

  it('keeps required sections when empty and skips empty optional ones', () => {
    const keys = orderedSections({ moved: [], trace: [], dates: [], new: [] }).map((o) => o.section.key);
    expect(keys).toEqual(['lead', 'moved', 'coverage']);
    expect(orderedSections({ lead: { headline: 'h' }, trace: [{}] }).map((o) => o.section.key)).toEqual(['lead', 'moved', 'trace', 'coverage']);
  });
});
