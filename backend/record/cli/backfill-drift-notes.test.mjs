import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDriftNotes } from './backfill-drift-notes.mjs';

const producer = { lambda: 'record/cli/backfill-drift-notes', runId: 'test' };
const log = (country, asOf, extra = {}) => ({ PK: `COUNTRY#${country}`, SK: `DRIFTLOG#${asOf}`, countryName: country, asOf, since: '2026-10-01', changeScore: { from: 40, to: 50, delta: 10 },
  currentRiskScore: 50, whyChanged: 'x', noSingleDriver: true, generatedAt: `${asOf}T05:30:00.000Z`, ...extra });

test('planDriftNotes: one archive-copy drift note per DRIFTLOG# item (model null, from archive); unresolved countries skipped', () => {
  const plan = planDriftNotes({ items: [log('Ukraine', '2026-10-10'), log('Atlantis', '2026-10-10'), { ...log('Ukraine', '2026-10-10'), SK: 'DRIFT#2026-10-10' }], producer });
  assert.deepEqual([plan.notes.length, plan.skipped, plan.failed], [1, [{ country: 'Atlantis', asOf: '2026-10-10' }], []]);
  const [n] = plan.notes;
  assert.deepEqual([n.subtype, n.subject, n.iso3, n.model, n.payload.from, n.at, n.threadId], ['drift', { kind: 'country', id: 'UKR' }, ['UKR'], null, 'archive', '2026-10-10T05:30:00.000Z', null]);
  assert.equal('generatedAt' in n.payload || 'PK' in n.payload, false);
});

test('planDriftNotes: the trigger story gives threadId; a re-plan gives the same noteId', () => {
  const it = log('Iran', '2026-10-11', { triggerEvent: { topicId: 't', title: 'T', threadId: 'thread-x' } });
  const a = planDriftNotes({ items: [it], producer }).notes[0];
  const b = planDriftNotes({ items: [it], producer: { ...producer, runId: 'other' } }).notes[0];
  assert.deepEqual([a.threadId, a.noteId === b.noteId], ['thread-x', true]);
});

test('planDriftNotes: a DRIFT# row with no DRIFTLOG# copy (written before the archive existed) is a note too; the pair of one run is one note (0053)', () => {
  const only = { ...log('Japan', '2026-06-24'), SK: 'DRIFT#2026-06-24' };
  const pair = [log('Iran', '2026-10-11'), { ...log('Iran', '2026-10-11'), SK: 'DRIFT#2026-10-11', ttl: 1 }];
  const plan = planDriftNotes({ items: [only, ...pair], producer });
  assert.deepEqual(plan.notes.map((n) => [n.subject.id, n.payload.asOf]).sort(), [['IRN', '2026-10-11'], ['JPN', '2026-06-24']]);
});
