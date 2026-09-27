import { describe, it, expect } from 'vitest';
import { deriveFedInto, deriveFedFrom } from '@/features/threads/lib/storyLinks.js';

const NOW = Date.now();
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();

describe('deriveFedInto', () => {
  it('keeps only outgoing edges from this thread', () => {
    const records = [{
      country: 'Iran',
      generatedAt: daysAgo(1),
      nodes: [{ threadId: 'this', summary: 'This story' }, { threadId: 'other', summary: 'Other story' }],
      edges: [
        { from: 'this', to: 'other', confidence: 'strong', lagDays: 3 },
        { from: 'other', to: 'this', confidence: 'weak' }, // incoming — not FED INTO
      ],
    }];
    const out = deriveFedInto('this', records);
    expect(out).toHaveLength(1);
    expect(out[0].targetThreadId).toBe('other');
    expect(out[0].confidence).toBe('strong');
  });

  it('drops edges from a systems record older than 30 days (S5)', () => {
    const records = [{
      country: 'Iran', generatedAt: daysAgo(40),
      nodes: [], edges: [{ from: 'this', to: 'other', confidence: 'strong' }],
    }];
    expect(deriveFedInto('this', records)).toEqual([]);
  });

  it('flags 7-30 day records as older but keeps them', () => {
    const records = [{
      country: 'Iran', generatedAt: daysAgo(10),
      nodes: [], edges: [{ from: 'this', to: 'other', confidence: 'medium' }],
    }];
    const out = deriveFedInto('this', records);
    expect(out[0].freshness).toBe('older');
  });

  it('de-dupes a target across multiple webs, keeping the strongest confidence', () => {
    const records = [
      { country: 'Iran', generatedAt: daysAgo(1), nodes: [], edges: [{ from: 'this', to: 'other', confidence: 'weak' }] },
      { country: 'US', generatedAt: daysAgo(1), nodes: [], edges: [{ from: 'this', to: 'other', confidence: 'strong' }] },
    ];
    const out = deriveFedInto('this', records);
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe('strong');
  });

  it('ignores self-loops and returns [] with no records', () => {
    expect(deriveFedInto('this', [])).toEqual([]);
    const records = [{ country: 'Iran', generatedAt: daysAgo(1), nodes: [], edges: [{ from: 'this', to: 'this', confidence: 'strong' }] }];
    expect(deriveFedInto('this', records)).toEqual([]);
  });
});

describe('deriveFedFrom', () => {
  it('keeps only incoming edges to this thread', () => {
    const records = [{
      country: 'Iran',
      generatedAt: daysAgo(1),
      nodes: [{ threadId: 'this', summary: 'This story' }, { threadId: 'other', summary: 'Other story' }],
      edges: [
        { from: 'other', to: 'this', confidence: 'medium', lagDays: 5 },
        { from: 'this', to: 'other', confidence: 'weak' }, // outgoing — not fed-from
      ],
    }];
    const out = deriveFedFrom('this', records);
    expect(out).toHaveLength(1);
    expect(out[0].sourceThreadId).toBe('other');
    expect(out[0].confidence).toBe('medium');
  });

  it('ignores self-loops and returns [] with no records', () => {
    expect(deriveFedFrom('this', [])).toEqual([]);
  });
});
