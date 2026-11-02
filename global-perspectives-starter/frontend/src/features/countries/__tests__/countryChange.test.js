// latestChange: the newest drift note that has BOTH a cited event title and a safe explanation. A flagged
// (direction-contradicting) note is never used as a cause; a backfilled flag is rebuilt from numbers only.
import { describe, it, expect } from 'vitest';
import { latestChange } from '@/features/countries/lib/countryChange.js';

const note = (over = {}) => ({
  asOf: '2026-10-30',
  whyChanged: 'Fighting reached the capital.',
  triggerEvent: { title: 'Capital shelled', topicId: 'topic-1' },
  ...over,
});
const threads = new Map([['topic-1', 'thread-capital-1'], ['topic-2', 'thread-port-2']]);

describe('latestChange', () => {
  it.each([[undefined], [null], [[]]])('no notes (%j) -> null', (notes) => {
    expect(latestChange(notes, threads)).toBeNull();
  });

  it('takes the first note (newest first) with an event title and an explanation, and resolves its story', () => {
    const out = latestChange([note()], threads);
    expect(out).toEqual({ asOf: '2026-10-30', why: 'Fighting reached the capital.', eventTitle: 'Capital shelled', threadId: 'thread-capital-1' });
  });

  it('skips notes missing the event title or the explanation (never a bare model claim)', () => {
    const noEvent = note({ asOf: '2026-11-01', triggerEvent: null });
    const noTitle = note({ asOf: '2026-10-31', triggerEvent: { topicId: 'topic-2' } });
    const noWhy = note({ asOf: '2026-10-31', whyChanged: '   ' });
    const good = note({ asOf: '2026-10-29', triggerEvent: { title: 'Port closed', topicId: 'topic-2' }, whyChanged: 'Trade halted.' });
    const out = latestChange([noEvent, noTitle, noWhy, good], threads);
    expect(out).toMatchObject({ asOf: '2026-10-29', eventTitle: 'Port closed', why: 'Trade halted.', threadId: 'thread-port-2' });
  });

  it('threadId is null when the topic is unknown or no map is given', () => {
    expect(latestChange([note({ triggerEvent: { title: 'T', topicId: 'zzz' } })], threads).threadId).toBeNull();
    expect(latestChange([note()]).threadId).toBeNull();
  });

  it('a flagged note is skipped: its cited event is not trusted as the cause', () => {
    const flagged = note({ asOf: '2026-11-01', directionFlag: { reason: 'direction mismatch' } });
    const older = note({ asOf: '2026-10-20', triggerEvent: { title: 'Older event', topicId: 'topic-2' } });
    expect(latestChange([flagged], threads)).toBeNull();
    expect(latestChange([flagged, older], threads)).toMatchObject({ asOf: '2026-10-20', eventTitle: 'Older event' });
  });
});
