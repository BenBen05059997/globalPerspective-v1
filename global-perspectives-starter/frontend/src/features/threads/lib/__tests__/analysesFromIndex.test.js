// analysesFromIndex — the analyses index gives the Stories page what `thread_analysis` gave. Fixture captured live on
// 2026-10-31 (curl, outside the tests): the action's answer for 6 stories and the record's index/analyses.json built from
// a copy of the live record. Compared through the functions the page runs on an analysis (storySummary, watchingOf,
// tierOf, the title). `newer` is the one documented difference: the action already had a newer analysis than the record's notes.
import { describe, it, expect } from 'vitest';
import { analysesFromIndex, analysesIndexUsable } from '@/features/threads/lib/analysesFromIndex.js';
import { storySummary, watchingOf, tierOf } from '@/features/threads/lib/storyGroups.js';
import data from './fixtures/analysesFromIndex.json';

const thread = { entries: [] };
const read = (a) => ({ title: a?.threadTitle ?? null, summary: storySummary(thread, a), watching: watchingOf(a), headline: tierOf(a), watchQuestions: a?.watchQuestions, dimensions: a?.dimensions, generatedAt: a?.generatedAt });

describe('analysesFromIndex against live captures', () => {
  const fromIndex = analysesFromIndex(data.index, [...data.ids, data.newer]);

  for (const id of data.ids) {
    it(`equal: every field the Stories page reads, ${id}`, () => {
      expect(read(fromIndex[id])).toEqual(read(data.action[id]));
      expect(read(fromIndex[id]).headline.tier).not.toBeUndefined();
    });
  }

  it('the map-only fields stay out of the index (trajectory, rootCauseChain, entryShortTitles, drift)', () => {
    for (const id of data.ids) for (const k of ['trajectory', 'rootCauseChain', 'entryShortTitles', 'driftNote', 'keyActors']) expect(fromIndex[id]).not.toHaveProperty(k);
  });

  it('documented difference: a story whose live analysis is newer than the record notes reads the notes\' older generation', () => {
    expect(data.action[data.newer].generatedAt > fromIndex[data.newer].generatedAt).toBe(true);
  });

  it('a story with no analysis is absent, as in the action; only requested ids are returned', () => {
    expect(analysesFromIndex(data.index, ['thread-none'])).toEqual({});
    expect(Object.keys(analysesFromIndex(data.index, [data.ids[0], 'thread-none']))).toEqual([data.ids[0]]);
  });

  it('an unusable index answers an empty map', () => {
    for (const bad of [null, {}, { analyses: [] }, { analyses: null }]) {
      expect(analysesIndexUsable(bad)).toBe(false);
      expect(analysesFromIndex(bad, data.ids)).toEqual({});
    }
  });
});
