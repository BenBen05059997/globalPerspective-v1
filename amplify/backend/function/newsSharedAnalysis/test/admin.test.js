import test from 'node:test';
import assert from 'node:assert/strict';
import { listArgs, deleteArgs } from '../../../../../scripts/share-admin.mjs';

test('share-admin queries the owner index and deletes by id only', () => {
  const l = listArgs('uid-1');
  assert.ok(l.includes('query') && l.includes('uid-createdAt-index') && l.includes('GlobalPerspectiveShares'));
  assert.equal(JSON.parse(l[l.indexOf('--expression-attribute-values') + 1])[':u'].S, 'uid-1');
  const d = deleteArgs('A'.repeat(22));
  assert.ok(d.includes('delete-item'));
  assert.deepEqual(JSON.parse(d[d.indexOf('--key') + 1]), { id: { S: 'A'.repeat(22) } });
});
