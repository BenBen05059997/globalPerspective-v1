import { describe, it, expect } from 'vitest';
import { viewForecast } from '@/features/threads/lib/viewForecast.js';
import { mostLikelyScenario } from '@/features/threads/lib/storyMode.js';
import { chipFor } from '@/shared/lib/questionChips.js';
import data from './fixtures/viewForecast.json';

// Fixtures captured live on 2026-10-31 (curl, outside the tests): the story view from /data/record/views/stories/<id>.json
// (forks and entry topic ids kept) and the page's own call, `prediction_snapshot` asked with the story's topic ids.
// `expect`: equal = same snapshot; equalNull = both give nothing; fallback = the view cannot answer (null, the hook asks
// the action); foreignThread = the action returned a forecast filed under ANOTHER story's thread id (the archive moved
// the topic to this story), which the view, keyed by thread, does not carry.
const NOT_IN_VIEW = ['title', 'status', 'questionSchema', 'threadId']; // the view carries none of these

function comparable(s) {
  if (!s) return s;
  const out = { ...s };
  NOT_IN_VIEW.forEach((k) => delete out[k]);
  return out;
}

describe('viewForecast against live captures', () => {
  const byKind = (k) => data.fixtures.filter((f) => f.expect === k);

  it('captured at least 20 real stories, including ones where the action returns null', () => {
    expect(data.fixtures.length).toBeGreaterThanOrEqual(20);
    expect(byKind('equalNull').length).toBeGreaterThan(0);
    expect(byKind('equalNull').every((f) => f.action === null)).toBe(true);
  });

  for (const f of data.fixtures.filter((x) => x.expect === 'equal')) {
    it(`equals the action field by field: ${f.threadId}`, () => {
      const got = viewForecast(f.view, { topicIds: f.topicIds });
      expect(got).not.toBeNull();
      expect(comparable(got)).toEqual(comparable(f.action));
      expect(got.threadId).toBe(f.view.threadId);
      // what the story page reads from it
      expect(mostLikelyScenario(got)).toEqual(mostLikelyScenario(f.action));
      const triggers = (s) => s.scenarios.flatMap((sc) => sc.triggers);
      expect(triggers(got).map(chipFor)).toEqual(triggers(f.action).map(chipFor));
    });
  }

  for (const f of byKind('equalNull')) {
    it(`gives null where the action gives null: ${f.threadId}`, () => {
      expect(viewForecast(f.view, { topicIds: f.topicIds })).toBeNull();
    });
  }

  for (const f of byKind('fallback')) {
    it(`gives null when the view cannot answer, so the hook asks the action: ${f.threadId}`, () => {
      expect(f.action).not.toBeNull();
      expect(viewForecast(f.view, { topicIds: f.topicIds })).toBeNull();
    });
  }

  for (const f of byKind('foreignThread')) {
    it(`never returns a forecast filed under another story: ${f.threadId}`, () => {
      expect(f.action.threadId).not.toBe(f.threadId);
      expect(f.action.threadId).not.toBe(f.view.threadId);
      const got = viewForecast(f.view, { topicIds: f.topicIds });
      if (got) expect(got.generatedAt < f.action.generatedAt).toBe(true); // the story's own, older forecast
    });
  }
});

describe('viewForecast rules', () => {
  const branch = (n, extra = {}) => ({
    branchId: `PRED#T/2026-10-20/${n}`, text: 'Most Likely', p: 40, trigger: `trigger ${n}`, resolutionSource: 'Reuters',
    due: '2026-11-30', verdict: null, question: true, qid: `q${n}`, scenarioP: 60, scoring: 'sampled', state: 'awaiting', ...extra,
  });
  const view = (branches, entries = [{ topicId: 'T' }]) => ({
    threadId: 'th', entries, forks: [{ forkId: 'f', drawnAt: '2026-10-20T04:00:00.000Z', branches }],
  });
  const ask = { topicIds: ['T'] };

  it('maps scenario, trigger and question fields', () => {
    const s = viewForecast(view([branch('0-0')]), ask);
    expect(s.generatedAt).toBe('2026-10-20T04:00:00.000Z');
    expect(s.scenarios).toEqual([{
      label: 'Most Likely', probability: 0.6,
      triggers: [{
        id: '0-0', text: 'trigger 0-0', deadline: '2026-11-30', verdict: null, confirmedBy: null, citation: null,
        question: true, qid: 'q0-0', p: 40, source: 'Reuters', scoring: 'sampled', state: 'awaiting',
        verdictUrl: null, verdictQuote: null, voidReason: null,
      }],
    }]);
  });

  it('turns a decided question into fired / not_fired with its evidence, and ignores a void on a non-question', () => {
    const yes = branch('0-0', { state: 'yes', verdict: { at: 'x', result: 'yes', decidedBy: 'job', evidence: { url: 'https://e.test/a', quote: 'said so' }, voidReason: null } });
    const no = branch('0-1', { state: 'no', verdict: { at: 'x', result: 'no', decidedBy: 'job', evidence: null, voidReason: null } });
    const old = branch('1-0', { question: false, qid: null, p: null, scoring: null, state: null, verdict: { at: 'x', result: 'void', decidedBy: 'op', evidence: null, voidReason: 'issued_before_method' } });
    const s = viewForecast(view([yes, no, old]), ask);
    const [a, b] = s.scenarios[0].triggers;
    expect([a.verdict, a.citation, a.verdictUrl, a.verdictQuote]).toEqual(['fired', 'https://e.test/a', 'https://e.test/a', 'said so']);
    expect([b.verdict, b.citation]).toEqual(['not_fired', null]);
    expect(s.scenarios[1].triggers[0]).toMatchObject({ verdict: null, question: false });
    expect(s.scenarios[1].triggers[0].qid).toBeUndefined();
  });

  it('drops triggers without a deadline and scenarios left empty; null when nothing is left', () => {
    expect(viewForecast(view([branch('0-0', { due: null }), branch('1-0')]), ask).scenarios.map((x) => x.triggers[0].id)).toEqual(['1-0']);
    expect(viewForecast(view([branch('0-0', { due: null })]), ask)).toBeNull();
  });

  it('is null for a view without question forks, an alias, no view, or no asked topics', () => {
    expect(viewForecast(view([branch('0-0', { qid: null, question: undefined })]), ask)).toBeNull();
    expect(viewForecast({ threadId: 'a', aliasOf: 'b' }, ask)).toBeNull();
    expect(viewForecast(null, ask)).toBeNull();
    expect(viewForecast(view([branch('0-0')]), { topicIds: [] })).toBeNull();
  });

  it('is null when the view does not know an asked topic (newer than the view)', () => {
    expect(viewForecast(view([branch('0-0')]), { topicIds: ['T', 'NEW'] })).toBeNull();
  });
});
