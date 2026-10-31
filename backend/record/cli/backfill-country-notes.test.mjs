import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCountryNotes } from './backfill-country-notes.mjs';

const producer = { lambda: 'record/cli/backfill-country-notes', runId: 'test' };
const item = { PK: 'COUNTRY#Japan', SK: 'COUNTRY_INTELLIGENCE', countryName: 'Japan', headline: 'H', bluf: 'B', keyDevelopments: [], whyItMatters: 'W', trajectory: 'stable',
  riskLevel: 'moderate', riskScore: 40, generatedAt: '2026-10-26T05:15:44.865Z', model: 'deepseek-v4-pro', ttl: 1 };
const hist = (date, extra = {}) => ({ PK: 'COUNTRY#Japan', SK: `HISTORY#${date}`, countryName: 'Japan', dateKey: date, riskLevel: 'high', riskScore: 70, trajectory: 'escalating',
  headline: 'H', generatedAt: `${date}T05:16:00.000Z`, ttl: 2, ...extra });

test('planCountryNotes: a full note per briefing, a history copy per older day, the same-run history row is not a second note', () => {
  const plan = planCountryNotes({ items: [item], producer, history: [hist('2026-09-01'), hist('2026-09-02'), hist('2026-10-26', { generatedAt: item.generatedAt })] });
  assert.deepEqual(plan.counts, { briefings: 1, history: 2 });
  assert.deepEqual(plan.skipped.map((s) => s.reason), ['same_run_as_briefing']);
  const copies = plan.notes.filter((n) => n.payload.from === 'history');
  assert.ok(copies.every((n) => n.model === null && n.subject.id === 'JPN' && n.part === ''));
  assert.equal(plan.notes.find((n) => !n.payload.from).model, 'deepseek-v4-pro');
});

test('planCountryNotes: a name with no ISO3 and a row the builder refuses are reported, not written', () => {
  const plan = planCountryNotes({ items: [{ ...item, countryName: 'Atlantis' }, { ...item, generatedAt: 'nope' }], history: [], producer });
  assert.equal(plan.notes.length, 0);
  assert.deepEqual(plan.skipped.map((s) => s.reason), ['no_iso3', 'notes: country needs a valid at']);
});
