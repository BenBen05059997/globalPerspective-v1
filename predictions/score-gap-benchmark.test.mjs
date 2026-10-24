import test from 'node:test';
import assert from 'node:assert/strict';
import { score, parseJsonl, latestByBranch } from './score-gap-benchmark.mjs';

const key = [
  { branchId: 'P/d/1', verdict: 'yes', strength: 'cited' },
  { branchId: 'P/d/2', verdict: 'yes', strength: 'cited' },
  { branchId: 'P/d/3', verdict: 'no', strength: 'cited' },
  { branchId: 'P/d/4', verdict: 'no', strength: 'absence' },
  { branchId: 'P/d/5', verdict: 'no', strength: 'absence' },
  { branchId: 'P/d/6', verdict: 'unclear', strength: null },
  { branchId: 'P/d/7', verdict: 'no', strength: 'cited' },
];
const L = (branchId, result, revision = 1, decidedAt = '2026-10-25T10:00:00Z') => ({ qid: 'q', branchId, result, revision, decidedAt });

test('strict score on cited rows, soft on absence, coverage', () => {
  const lines = [L('P/d/1', 'yes'), L('P/d/2', 'void'), L('P/d/3', 'yes'), L('P/d/4', 'no'), L('P/d/5', 'void'), L('P/d/6', 'yes'), L('Z/x/1', 'no'), { qid: 'legacy', branchId: null, result: 'no' }];
  const r = score(key, lines);
  assert.equal(r.coverage.answered, 6); assert.equal(r.coverage.of, 7);
  assert.equal(r.strict.citedRows, 3 + 0 + 1); // rows 1,2,3,7
  assert.equal(r.strict.answered, 3);
  assert.equal(r.strict.accuracyAnswered, 0.333); // only row 1 right
  assert.equal(r.strict.accuracyAll, 0.25);
  assert.equal(r.strict.yesPrecision, 0.5); // yes on 1 (right) and 3 (wrong)
  assert.equal(r.strict.noPrecision, null);
  assert.deepEqual([r.soft.agree, r.soft.unclear, r.soft.disagree], [1, 1, 0]); // unclear on absence is not an error
  assert.equal(r.soft.agreementOfDecided, 1);
  assert.equal(r.offKeyYes, 1); // yes on the unclear key row
  assert.equal(r.linesWithoutBranchId, 1); assert.equal(r.linesNotInKey, 1);
});

test('the latest revision per branch wins; jsonl parses', () => {
  const text = [L('P/d/1', 'no', 1), L('P/d/1', 'yes', 2, '2026-10-26T00:00:00Z')].map((l) => JSON.stringify(l)).join('\n') + '\n';
  const { byBranch } = latestByBranch(parseJsonl(text));
  assert.equal(byBranch.get('P/d/1').result, 'yes');
  assert.equal(score(key, parseJsonl(text)).strict.yesPrecision, 1);
});
