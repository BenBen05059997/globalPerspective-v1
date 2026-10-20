import { describe, it, expect } from 'vitest';
import { buildDeadlines } from '@/shared/lib/deadlines.js';

describe('buildDeadlines', () => {
  it('collects only triggers with a real deadline', () => {
    const forecast = {
      scenarios: [
        { label: 'Escalation', triggers: [{ id: 'a', text: 'X happens', deadline: '2026-12-01' }, { id: 'b', text: 'no deadline' }] },
      ],
    };
    const deadlines = buildDeadlines(forecast);
    expect(deadlines).toEqual([{ id: 'a', label: 'X happens', deadline: '2026-12-01', verdict: null, scenarioLabel: 'Escalation' }]);
  });
  it('is empty with no forecast (S6-style skip)', () => {
    expect(buildDeadlines(null)).toEqual([]);
  });
});
