// Run: node questionBoard.test.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildQuestionBoard } = require('./questionBoard.js');
const { computeTrackRecord } = require('./trackRecord.js');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ ${name}`); } };

const H = (n) => 'h'.repeat(n);
const pred = (topic, sk, qs) => ({
  PK: `PRED#${topic}`, SK: sk, generatedAt: `${sk}T05:00:00Z`, questionSchema: 1, methodologyVersion: 1,
  scenarios: [{ label: 'x', probability: 0.5, triggers: qs.map(([id, p]) => ({ id, qid: `${topic}-${id}`, text: 't', deadline: '2026-12-01', question: true, p, resolutionSource: 'Reuters or AP wire report' })) }],
});
const sampled = (qid, weekId, deadline, extra = {}) => ({ PK: `Q#${qid}`, SK: 'SAMPLED', qid, weekId, question: `Q ${qid}`, deadline, resolutionSource: 'Reuters or AP wire report', storyTitle: 'S', issuedAt: '2026-10-06T05:00:00Z', clusterKey: `c-${qid}`, ...extra });
const commit = (w, start, at) => ({ PK: `SEED#${w}`, SK: 'COMMIT', weekId: w, weekStart: start, weekEnd: start, commitHash: 'abc', committedAt: at });

// ---- empty: honest zeros and every alarm condition quiet ----
const e = buildQuestionBoard([], '2026-10-01T10:00:00Z');
ok('empty: zero counts, null scoring, quiet health', e.issued === 0 && e.counts.locked === 0 && e.scoring === null
  && !e.settleHealth.drawMissed && !e.settleHealth.commitMissing && !e.settleHealth.tickStale && e.settleHealth.dueUnsettled === 0);
// questions logged but nothing committed yet (the warm-up): still quiet
const warm = buildQuestionBoard([pred('a', '2026-10-01', [['0-0', 60]])], '2026-10-03T12:00:00Z');
ok('warm-up: issued counted as warm-up, firstCommit null, alarm quiet', warm.issued === 1 && warm.warmUp === 1 && warm.firstCommit === null
  && !warm.settleHealth.drawMissed && !warm.settleHealth.commitMissing && !warm.settleHealth.tickStale);

// ---- a two-week fixture: W41 drawn with 3 picks (1 yes, 1 void, 1 unchecked), W42 committed and open ----
const rows = [
  commit('2026-W41', '2026-10-05', '2026-10-01T10:30:00Z'), commit('2026-W42', '2026-10-12', '2026-10-01T10:30:00Z'), commit('2026-W43', '2026-10-19', '2026-10-12T10:30:00Z'), commit('2026-W44', '2026-10-26', '2026-10-19T10:30:00Z'), commit('2026-W45', '2026-11-02', '2026-10-26T10:30:00Z'),
  { PK: 'SEED#2026-W41', SK: 'REVEAL', weekId: '2026-W41', seedHex: 'ab', revealedAt: '2026-10-12T10:30:00Z' },
  { PK: 'SAMPLE#2026-W41', SK: 'DRAW', weekId: '2026-W41', K: 22, eligible: 9, clusters: 5, pool: [{ q: 'x', c: 'y' }], picked: [{ qid: 'a-0-0' }, { qid: 'b-0-0' }, { qid: 'c-0-0' }] },
  { PK: 'SAMPLE#2026-W42', SK: 'DRAW', weekId: '2026-W42', K: 22, eligible: 0, clusters: 0, pool: [], picked: [] },
  { PK: 'SAMPLE#2026-W43', SK: 'DRAW', weekId: '2026-W43', K: 22, eligible: 0, clusters: 0, pool: [], picked: [] },
  pred('a', '2026-10-06', [['0-0', 62]]), pred('b', '2026-10-06', [['0-0', 40]]), pred('c', '2026-10-07', [['0-0', 25]]),
  sampled('a-0-0', '2026-W41', '2026-10-20'), sampled('b-0-0', '2026-W41', '2026-10-20'), sampled('c-0-0', '2026-W41', '2026-11-30'),
  { PK: 'Q#a-0-0', SK: 'VERDICT', qid: 'a-0-0', verdict: 'yes', decidedAt: '2026-10-26T09:00:00Z', evidence: { url: 'https://x', quote: 'quote' } },
  { PK: 'Q#b-0-0', SK: 'VERDICT', qid: 'b-0-0', verdict: 'void', voidReason: 'event_moot', decidedAt: '2026-10-26T09:05:00Z' },
  { PK: 'SETTLE#2026-W41', SK: 'TICK#2026-10-12T10:30:00Z', at: '2026-10-12T10:30:00Z' },
  { PK: 'SETTLE#2026-W44', SK: 'TICK#2026-10-27T10:30:00Z', at: '2026-10-27T10:30:00Z' },
  { PK: 'SETTLE#2026-W43', SK: 'REVIEW#2026-10-26T10:00:00Z', at: '2026-10-26T10:00:00Z', confirmed: 2 },
];
const b = buildQuestionBoard(rows, '2026-10-27T12:00:00Z');
ok('counts: 3 locked, 1 yes, 1 void, 1 awaiting, resolved 1', b.counts.locked === 3 && b.counts.yes === 1 && b.counts.void === 1 && b.counts.awaiting === 1 && b.counts.resolved === 1);
ok('p is joined from the frozen row', b.sampled.find((s) => s.qid === 'a-0-0').p === 62);
ok('verdict carries source and quote', b.sampled.find((s) => s.qid === 'a-0-0').verdict.url === 'https://x');
ok('void carries its reason', b.sampled.find((s) => s.qid === 'b-0-0').voidReason === 'event_moot');
ok('scoring is null below 150', b.scoring === null);
ok('weeks span first commit .. latest committed', b.weeks[0].weekId === '2026-W41' && b.weeks.at(-1).weekId === '2026-W45');
const w41 = b.weeks[0];
ok('week 41: drawn, reveal + pool published', w41.drawn && w41.picked === 3 && w41.reveal.seedHex === 'ab' && w41.draw.pool.length === 1);
const w43 = b.weeks.find((w) => w.weekId === '2026-W43'); const w44 = b.weeks.find((w) => w.weekId === '2026-W44');
ok('settling log: 2 due in W43 (deadline 10-20 + 3d); 2 settled (1 void) and a review in W44', w43.due === 2 && w43.settled === 0 && w44.settled === 2 && w44.void === 1 && w44.reviewed === true);
ok('a healthy board raises no alarm', !b.settleHealth.drawMissed && !b.settleHealth.commitMissing && !b.settleHealth.tickStale && b.settleHealth.dueUnsettled === 0);

// ---- alarm conditions ----
const missedDraw = buildQuestionBoard(rows.filter((r) => r.PK !== 'SAMPLE#2026-W41'), '2026-10-13T13:00:00Z'); // Tuesday after 12:00
ok('missed draw: flagged after Tuesday 12:00', missedDraw.settleHealth.drawMissed && missedDraw.settleHealth.expectedDrawWeek === '2026-W41');
const notYet = buildQuestionBoard(rows.filter((r) => r.PK !== 'SAMPLE#2026-W41'), '2026-10-13T09:00:00Z'); // Tuesday 09:00, still inside the grace
ok('missed draw: not flagged inside the grace window', !notYet.settleHealth.drawMissed);
const overdue = buildQuestionBoard(rows.filter((r) => !r.PK.startsWith('Q#a-') || r.SK === 'SAMPLED'), '2026-11-10T12:00:00Z');
ok('due and unsettled reported with its age', overdue.settleHealth.dueUnsettled >= 1 && overdue.settleHealth.oldestDueUnsettledDays >= 10);
const noNext = buildQuestionBoard(rows.filter((r) => !['2026-W43', '2026-W44', '2026-W45'].includes(r.weekId)), '2026-10-20T12:00:00Z');
ok('commit missing: next week has no commitment', noNext.settleHealth.commitMissing);

// ---- legacy aggregate ignores question triggers ----
const legacyIn = [{ title: 'L', methodologyVersion: 1, scenarios: [{ label: 's', probability: 0.5, triggers: [{ text: 'q', deadline: '2026-12-01', question: true, p: 60, finalVerdict: 'fired', confirmedAt: '2026-11-01' }, { text: 'old', deadline: '2026-12-01' }] }] }];
const lg = computeTrackRecord(legacyIn);
ok('legacy block skips question triggers (no scoring at scenario probability)', lg.totalDatedTriggers === 1 && lg.resolvedTriggers === 0 && lg.brierScore === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
