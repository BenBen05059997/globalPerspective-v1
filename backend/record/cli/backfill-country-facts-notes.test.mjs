import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCountryFactsNotes } from './backfill-country-facts-notes.mjs';

const producer = { lambda: 'record/cli/backfill-country-facts-notes', runId: 'test' };
const row = (country, extra = {}) => ({ PK: `FACTS#${country}`, SK: 'COUNTRY_FACTS', ttl: 1, countryName: country, capital: { names: ['X'], source: 'wikidata', checkedAt: '2026-10-26T20:00:01Z' },
  lastUpdatedAt: '2026-10-26T20:00:01.500Z', ...extra });

test('planCountryFactsNotes: one model-less note per FACTS# item, at = lastUpdatedAt, ISO3 subject; unresolved and undated rows are reported', () => {
  const plan = planCountryFactsNotes({ items: [row('Japan'), row('DR Congo'), row('Atlantis'), row('Spain', { lastUpdatedAt: undefined }), { PK: 'FACTS#Japan', SK: 'OTHER' }], producer });
  assert.deepEqual(plan.notes.map((n) => [n.subject.id, n.model, n.at]), [['JPN', null, '2026-10-26T20:00:01.500Z'], ['COD', null, '2026-10-26T20:00:01.500Z']]);
  assert.deepEqual(plan.skipped, [{ country: 'Atlantis', reason: 'no_iso3' }, { country: 'Spain', reason: 'no_lastUpdatedAt' }]);
  assert.deepEqual(plan.failed, []);
  assert.equal('ttl' in plan.notes[0].payload || 'lastUpdatedAt' in plan.notes[0].payload, false);
});

test('planCountryFactsNotes: a re-plan gives the same noteId', () => {
  const a = planCountryFactsNotes({ items: [row('Japan')], producer }).notes[0];
  const b = planCountryFactsNotes({ items: [row('Japan')], producer: { ...producer, runId: 'other' } }).notes[0];
  assert.equal(a.noteId, b.noteId);
});
