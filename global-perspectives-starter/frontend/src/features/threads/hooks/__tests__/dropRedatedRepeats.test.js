import { describe, it, expect } from 'vitest';
import { dropRedatedRepeats } from '@/features/threads/hooks/useNarrativeThread';

describe('dropRedatedRepeats', () => {
  it('keeps the earliest copy of a re-dated headline (live AfD case: 13 Sep re-written as 27 Sep)', () => {
    const t = 'Tens of Thousands March Across Germany';
    const out = dropRedatedRepeats([
      { date: '2026-09-12', title: 'Other' },
      { date: '2026-09-13', title: t },
      { date: '2026-09-27', title: t },
    ]);
    expect(out.map((e) => e.date)).toEqual(['2026-09-12', '2026-09-13']);
  });

  it('keeps distinct headlines on the same day and entries without a title', () => {
    const out = dropRedatedRepeats([{ date: '2026-09-06', title: 'A' }, { date: '2026-09-06', title: 'B' }, { date: '2026-09-07' }]);
    expect(out).toHaveLength(3);
  });

  it('passes non-arrays through', () => {
    expect(dropRedatedRepeats(null)).toBeNull();
  });
});
