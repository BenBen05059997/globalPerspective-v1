'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Q = require('../src/quality');
const { AUDIT_QUERY } = require('../src/aws');
const { buildOps } = require('../src/ops');
const { run } = require('../src/index');
const prices = require('../src/prices.json');

const NOW = Date.parse('2026-11-05T00:20:00Z');   // first run of the UTC day; the checked day is 2026-11-04
const DAY = '2026-11-04';
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

const sit = (id, title, iso3, state = 'peak') => ({ id, verb_label: title, iso3_affected: iso3, state });
const entry = (title, summary) => ({ title, topicId: `${title}-0`, ai: { summary } });
const verdict = (o) => ({ qid: 'q', result: 'void', voidReason: 'record gap', reason: 'record gap', revision: 1, gapDays: [], ...o });
const runFile = (o = {}) => JSON.stringify({ date: 'x', status: 'ok', inputs: { archiveDay: 'present' }, ...o });
const mergeFile = (rules) => JSON.stringify({ at: `${DAY}T12:43:59Z`, merges: rules.map((rule) => ({ rule, isNew: true })) });

/** A fake world with every run file present for the 14 closed days unless overridden. */
function world(over = {}) {
  const files = {
    'world/latest.json': JSON.stringify({ generated_at: '2026-11-05T00:13:59Z', situations: [] }),
    [`record/inbox/entries/${DAY}.jsonl`]: jsonl([entry('Clean', '- Troops moved, per Al Jazeera.')]),
    [`record/inbox/verdicts/${DAY}.jsonl`]: jsonl([]),
    ...over,
  };
  for (let i = 1; i <= 14; i += 1) {
    const d = new Date(Date.parse('2026-11-05T00:00:00Z') - i * 86400000).toISOString().slice(0, 10);
    if (!(`record/runs/${d}.json` in over)) files[`record/runs/${d}.json`] = runFile();
  }
  return files;
}
function aws(files, over = {}) {
  return {
    readText: async (k) => { const v = files[k]; if (v instanceof Error) throw v; return v == null ? null : { text: v, at: null }; },
    listKeys: async (prefix) => Object.keys(files).filter((k) => k.startsWith(prefix)),
    clientErrorRows: async () => [],
    auditLog: async () => null,
    ...over,
  };
}

test('the check day is the last closed UTC day', () => {
  assert.equal(Q.qualityDay(NOW), DAY);
  assert.equal(Q.qualityDay(Date.parse('2026-11-05T23:59:00Z')), DAY);
});

// ---- 1 ----
test('duplicates: same normalised title and same country set among OPEN situations; closed, other countries and other titles are not duplicates', () => {
  const r = Q.findDuplicates({ generated_at: 'g', situations: [
    sit('a', 'Israel  Election Commission rejects claims', ['ISR']), sit('b', 'israel election commission rejects claims', ['ISR']),
    sit('c', 'Israel election commission rejects claims', ['ISR', 'USA']),            // other country set
    sit('d', 'Israel election commission rejects claims', ['ISR'], 'closed'),          // closed
    sit('e', 'Quake hits Peru', ['PER']), sit('f', 'Quake hits Peru', ['PER'], 'cooling'),
    sit('g', 'Unique', ['FRA']),
  ] });
  assert.equal(r.status, 'ok');
  assert.equal(r.source, 'world/latest.json');
  assert.equal(r.at, 'g');
  assert.equal(r.open, 6);
  assert.equal(r.groups, 2);
  assert.equal(r.situations, 4);
  assert.deepEqual(r.examples.map((e) => e.ids), [['a', 'b'], ['e', 'f']]);
  assert.deepEqual(r.examples[0].countries, ['ISR']);
});

test('merged: counts the tracker merge files of the day by rule; an unreadable file is counted, not guessed', async () => {
  const files = world({
    'situations/merges/2026/11/04/10/1013.json': mergeFile(['url']),
    'situations/merges/2026/11/04/12/1243.json': mergeFile(['url', 'title-sim']),
    'situations/merges/2026/11/04/20/2043.json': new Error('boom'),
    'situations/merges/2026/11/03/09/0900.json': mergeFile(['url']),
  });
  const r = await Q.mergedPart(aws(files), DAY);
  assert.deepEqual({ merged: r.merged, files: r.files, unreadable: r.unreadable, byRule: r.byRule }, { merged: 3, files: 3, unreadable: 1, byRule: { url: 2, 'title-sim': 1 } });
  assert.equal(r.source, 'situations/merges/2026/11/04/');
  assert.equal(r.day, DAY);
  assert.equal((await Q.mergedPart(aws(world()), DAY)).merged, 0);
});

test('situations: world file missing is not_available; a failing list is an error that names its source', async () => {
  const noWorld = world(); delete noWorld['world/latest.json'];
  const pulled = await Q.pullQuality({ aws: aws(noWorld, { listKeys: async () => { throw new Error('AccessDenied'); } }), now: NOW });
  const s = pulled.checks.situations;
  assert.equal(s.duplicates.status, 'not_available');
  assert.match(s.duplicates.why, /not there/);
  assert.deepEqual({ status: s.merged.status, error: s.merged.error, source: s.merged.source }, { status: 'error', error: 'AccessDenied', source: 'situations/merges/2026/11/04/' });
});

// ---- 2 ----
test('self-describing summaries: matches the source-describing phrases, counts and caps examples, ignores ordinary words', () => {
  const entries = [
    entry('A', '- Vote result pending. The snippets do not report a result.'),
    entry('B', '- According to the sources, talks resumed.'),
    entry('C', '- The headline says a deal; per Reuters, no deal.'),
    entry('D', '- Per Reuters the report said troops left; sources said so; articles of impeachment were filed.'),
    entry('E', '- The provided articles describe it.'),
    entry('F', '- the SNIPPET lacks a date'),
    entry('G', '- The snippets again'),
    { title: 'no ai' }, { title: 'bad', ai: { summary: 5 } },
  ];
  const r = Q.findSelfReference(entries);
  assert.equal(r.entries, 9);
  assert.equal(r.withSummary, 7);
  assert.equal(r.matched, 5);                      // A B C F G; E ("the provided articles") and D (ordinary words) are not matched
  assert.equal(r.examples.length, 5);
  assert.deepEqual(r.examples[0], { title: 'A', phrase: 'The snippets' });
  assert.deepEqual(r.examples[1], { title: 'B', phrase: 'According to the sources' });
  assert.equal(r.byPhrase['the snippets'], 2);
  assert.equal(Q.findSelfReference(entries, 2).examples.length, 2);
  const many = Q.findSelfReference(Array.from({ length: 9 }, (_, i) => entry(`T${i}`, 'The snippets say.')));
  assert.equal(many.matched, 9);
  assert.equal(many.examples.length, 5);
});

test('self-describing summaries: reads the day\'s entries file, names source and day; no file is not_available', async () => {
  const files = world({ [`record/inbox/entries/${DAY}.jsonl`]: `${jsonl([entry('X', 'The sources differ.'), entry('Y', 'ok')])}not json\n` });
  const r = await Q.selfReferencePart(aws(files), DAY);
  assert.deepEqual({ status: r.status, day: r.day, source: r.source, entries: r.entries, matched: r.matched, unparsed: r.unparsed }, { status: 'ok', day: DAY, source: `record/inbox/entries/${DAY}.jsonl`, entries: 2, matched: 1, unparsed: 1 });
  const none = world(); delete none[`record/inbox/entries/${DAY}.jsonl`];
  const n = await Q.selfReferencePart(aws(none), DAY);
  assert.equal(n.status, 'not_available');
  assert.equal(n.day, DAY);
});

// ---- 3 ----
test('pins outside their country: not available, and it names what is missing', () => {
  const r = Q.pinsPart(DAY);
  assert.equal(r.status, 'not_available');
  assert.equal(r.day, DAY);
  assert.match(r.why, /storyCentroid/);
  assert.match(r.why, /Missing: one counter/);
});

// ---- 4 ----
test('forecast voids: by reason with record gap first, gap days named, corrections not counted as settlements', () => {
  const r = Q.countVoids([
    verdict({ voidReason: 'unclear after 3 drafts', reason: 'unclear after 3 drafts' }),
    verdict({ gapDays: ['2026-10-13', '2026-10-14'] }), verdict({ gapDays: ['2026-10-14', '2026-10-20'] }),
    verdict({ result: 'yes', voidReason: null, reason: 'quote' }),
    verdict({ result: 'yes', voidReason: null, revision: 2 }),
    verdict({ voidReason: 'duplicate', reason: 'x' }), verdict({ voidReason: 'duplicate', reason: 'x' }), verdict({ voidReason: 'duplicate', reason: 'x' }),
  ]);
  assert.equal(r.settled, 7);
  assert.equal(r.corrections, 1);
  assert.equal(r.voids, 6);
  assert.deepEqual(r.results, { void: 6, yes: 1 });
  assert.deepEqual(r.byReason, [{ reason: 'record gap', count: 2 }, { reason: 'duplicate', count: 3 }, { reason: 'unclear after 3 drafts', count: 1 }]);
  assert.deepEqual(r.recordGapDays, ['2026-10-13', '2026-10-14', '2026-10-20']);
});

test('forecast voids: reads the day\'s verdict file; no file for the day is said so (zero settled), not an error', async () => {
  const withFile = world({ [`record/inbox/verdicts/${DAY}.jsonl`]: jsonl([verdict({ gapDays: ['2026-10-13'] }), verdict({ result: 'no', voidReason: null })]) });
  const f = await Q.voidsPart(aws(withFile), DAY);
  assert.deepEqual({ fileAbsent: f.fileAbsent, voids: f.voids, settled: f.settled, day: f.day }, { fileAbsent: false, voids: 1, settled: 2, day: DAY });
  const files = world(); delete files[`record/inbox/verdicts/${DAY}.jsonl`];
  const r = await Q.voidsPart(aws(files), DAY);
  assert.deepEqual({ status: r.status, fileAbsent: r.fileAbsent, voids: r.voids, source: r.source }, { status: 'ok', fileAbsent: true, voids: 0, source: `record/inbox/verdicts/${DAY}.jsonl` });
});

test('coverage gaps per day: the resolver\'s rule (run ok/partial and archive day present) over the 14 closed days', async () => {
  const files = world({
    'record/runs/2026-10-27.json': runFile({ status: 'failed' }),
    'record/runs/2026-10-30.json': runFile({ inputs: { archiveDay: 'missing' } }),
    'record/runs/2026-11-01.json': runFile({ status: 'partial' }),                           // partial with the archive is covered
    'record/runs/2026-10-31.json': runFile({ inputs: { archiveDay: { thin: 15 } } }),
  });
  delete files['record/runs/2026-10-25.json'];                                              // no run file
  const r = await Q.coveragePart(aws(files), DAY, NOW);
  assert.equal(r.status, 'ok');
  assert.equal(r.from, '2026-10-22');
  assert.equal(r.to, DAY);
  assert.equal(r.days, 14);
  assert.deepEqual(r.gaps, [{ day: '2026-10-25', why: 'no run file' }, { day: '2026-10-27', why: 'run status failed' }, { day: '2026-10-30', why: 'archive day missing' }, { day: '2026-10-31', why: 'archive day thin:15' }]);
  assert.equal(r.source, 'record/runs/DAY.json');
});

test('coverage gaps: one unreadable run is a gap that says why; every run unreadable is an error', async () => {
  const one = await Q.coveragePart(aws(world({ 'record/runs/2026-10-30.json': new Error('AccessDenied') })), DAY, NOW);
  assert.deepEqual(one.gaps, [{ day: '2026-10-30', why: 'unreadable: AccessDenied' }]);
  const all = await Q.coveragePart({ readText: async () => { throw new Error('AccessDenied'); } }, DAY, NOW);
  assert.deepEqual({ status: all.status, error: all.error }, { status: 'error', error: 'unreadable: AccessDenied' });
});

// ---- 5 ----
const ts = (t) => `2026-11-04 ${t}`;
const aline = (t, rob, verdictWord, title, id = 'e97f93d5-5876-43ea-a5d4-288463252a33') => ({ '@timestamp': ts(t), '@message': `2026-11-04T${t}Z\t${id}\tINFO\t[audit] ${rob.padEnd(12)} | ${verdictWord} | ${title}\n` });   // Insights keeps the log line's newline

test('the audit query selects the [audit] lines the Lambda logs', () => {
  assert.match(AUDIT_QUERY, /\\\[audit\\\]/);
  assert.match(AUDIT_QUERY, /fields @timestamp, @message/);
});

test('source audit: the latest run only (by request id), verdict counts, drifted titles; dead outlets are not available and say what is missing', async () => {
  const rows = [
    aline('11:30:26.000', 'corroborated', 'DRIFT', 'Old run drift', 'aaaaaaaa-5876-43ea-a5d4-288463252a33'),
    { '@timestamp': '2026-11-02 11:30:00.000', '@message': '2026-11-02T11:30:00.000Z\taaaaaaaa-5876-43ea-a5d4-288463252a33\tINFO\t[audit] single | DRIFT | Earlier' },
    aline('11:30:26.740', 'corroborated', 'DRIFT', 'Democrats Win US House'),
    aline('11:30:28.379', 'corroborated', 'OK', 'Georgia Governor'),
    aline('11:30:34.012', 'single      ', 'OK', 'South Carolina Senate'),
    aline('11:30:36.997', 'none', 'AUDIT_ERROR', 'Ossoff: no-summary'),
    { '@timestamp': ts('11:30:37.000'), '@message': 'Source audit: 1 summary-drift / 1 audit-errors / 2 single-source of 4 checked.' },
  ];
  const r = await Q.auditPart(aws(world(), { auditLog: async (from, to) => { assert.equal(to, NOW); assert.equal(from, NOW - 7 * 86400000); return rows; } }), NOW);
  assert.equal(r.status, 'ok');
  assert.equal(r.day, '2026-11-04');
  assert.match(r.source, /\/aws\/lambda\/newsSourceAudit/);
  assert.deepEqual({ checked: r.checked, drift: r.drift, auditErrors: r.auditErrors, singleSource: r.singleSource }, { checked: 4, drift: 1, auditErrors: 1, singleSource: 2 });
  assert.deepEqual(r.drifted, [{ title: 'Democrats Win US House', robustness: 'corroborated' }]);
  assert.equal(r.deadOutlets.status, 'not_available');
  assert.match(r.deadOutlets.why, /does not look for dead outlets/);
  assert.match(r.deadOutlets.why, /Missing: a per-outlet fetch result/);
});

test('source audit: no run in the window, or no log group, is not_available with the reason', async () => {
  const none = await Q.auditPart(aws(world(), { auditLog: async () => [] }), NOW);
  assert.equal(none.status, 'not_available');
  assert.match(none.why, /no newsSourceAudit run in the last 7 days/);
  const group = await Q.auditPart(aws(world()), NOW);
  assert.equal(group.status, 'not_available');
  assert.match(group.why, /does not exist/);
  assert.equal(group.deadOutlets.status, 'not_available');
});

// ---- 6 ----
test('median is the middle value, or the mean of the two middle ones, null for none', () => {
  assert.equal(Q.median([3, 1, 2]), 2);
  assert.equal(Q.median([4, 1, 2, 3]), 2.5);
  assert.equal(Q.median([]), null);
});

test('client errors by page: the day against the median of the 14 days before it, zeros counted, pages from the first-hit URL', () => {
  const home = 'https://globalperspective.net/';
  const rows = [
    { day: DAY, count: 9, url: home },
    { day: DAY, count: 2, url: 'https://globalperspective.net/?story=thread-x' },          // still the map family
    { day: DAY, count: 4, url: 'https://globalperspective.net/track-record' },
    { day: DAY, count: 1, url: '' },
    { day: DAY, count: 1, url: 'not a url' },                                               // unparseable: unknown page
    // Map baseline: 1, 1, 1, 5, 5, 5, 5 on seven of the 14 days before DAY, zero on the other seven: the middle pair is 0 and 1.
    ...['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'].map((day, i) => ({ day, count: i < 3 ? 1 : 5, url: home })),
    { day: '2026-10-20', count: 99, url: home },                                           // older than the window
    { day: '2026-11-05', count: 99, url: home },                                           // after the checked day
  ];
  const r = Q.errorsByPage(rows, DAY);
  assert.equal(r.baselineFrom, '2026-10-21');
  assert.equal(r.baselineTo, '2026-11-03');
  const by = Object.fromEntries(r.pages.map((p) => [p.id, p]));
  assert.deepEqual([by.map.day, by.map.median], [11, 0.5]);
  assert.deepEqual([by.trackRecord.day, by.trackRecord.median], [4, 0]);
  assert.equal(by.unknown.day, 2);
  assert.equal(r.total, 17);
  assert.equal(r.median, 0.5);
  assert.deepEqual(r.pages.map((p) => p.id), ['map', 'trackRecord', 'unknown']);
});

test('client errors: the scan projects three attributes only, and the result carries no message, stack, user agent or uid', async () => {
  const a = aws(world(), { clientErrorRows: async () => [{ day: DAY, count: 3, url: 'https://globalperspective.net/board' }] });
  const r = await Q.clientErrorsPart(a, DAY);
  assert.equal(r.status, 'ok');
  assert.equal(r.day, DAY);
  assert.match(r.source, /GlobalPerspectiveClientErrors/);
  assert.equal(r.pages[0].id, 'board');
  assert.match(r.note, /first hit/);
  const src = fs.readFileSync(require.resolve('../src/aws.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function clientErrorRows'), src.indexOf('listKeys(prefix)'));
  assert.match(fn, /ProjectionExpression: '#d, #c, sampleUrl'/);
  assert.ok(!/sampleUa|sampleStack|message|uid|email/i.test(fn));
});

// ---- the section ----
test('pull: six checks, each with its source; one failing check does not stop the others', async () => {
  const a = aws(world({ [`record/inbox/entries/${DAY}.jsonl`]: new Error('AccessDenied') }), { clientErrorRows: async () => { throw new Error('no scan'); }, auditLog: async () => [aline('11:30:00.000', 'single', 'OK', 'T')] });
  const p = await Q.pullQuality({ aws: a, now: NOW });
  assert.equal(p.day, DAY);
  assert.deepEqual(Object.keys(p.checks), Q.CHECK_IDS);
  assert.equal(p.checks.selfReference.status, 'error');
  assert.equal(p.checks.selfReference.error, 'AccessDenied');
  assert.equal(p.checks.selfReference.source, `record/inbox/entries/${DAY}.jsonl`);
  assert.equal(p.checks.clientErrors.status, 'error');
  assert.equal(p.checks.sourceAudit.status, 'ok');
  assert.equal(p.checks.forecast.coverage.status, 'ok');
  assert.equal(p.checks.pins.status, 'not_available');
});

test('due: never built, a new UTC day, or a failed check; the retry reads only the failed checks', async () => {
  const healthy = await Q.pullQuality({ aws: aws(world()), now: NOW });
  const q = Q.buildQuality({ pull: healthy, prev: null, now: NOW });
  assert.equal(Q.qualityPullDue(null, NOW), true);
  assert.equal(Q.qualityPullDue({}, NOW), true);
  assert.equal(Q.qualityPullDue({ quality: q }, NOW + 3600000), false);          // not_available is a fact, not a failure
  assert.equal(Q.qualityPullDue({ quality: q }, NOW + 86400000), true);          // next UTC day
  const broken = JSON.parse(JSON.stringify(q)); broken.checks.situations.merged = { status: 'error', error: 'x' };
  assert.equal(Q.qualityPullDue({ quality: broken }, NOW + 3600000), true);

  const base = aws(world());
  const reads = [];
  const counting = { ...base, readText: async (k) => { reads.push(k); return base.readText(k); }, listKeys: async (p) => { reads.push(`list ${p}`); return []; } };
  const again = await Q.pullQuality({ aws: counting, now: NOW + 3600000, prev: broken });
  assert.deepEqual(reads.filter((k) => k.startsWith('record/')), []);              // the healthy checks were kept as they were
  assert.ok(reads.includes('world/latest.json'));                                  // the failed check was read again
  assert.equal(again.checks.situations.merged.status, 'ok');
  assert.deepEqual(again.checks.selfReference, healthy.checks.selfReference);
});

test('buildQuality: keeps the earlier section when nothing was pulled, null when never built; buildOps carries it', async () => {
  assert.equal(Q.buildQuality({ pull: null, prev: null, now: NOW }), null);
  const pull = await Q.pullQuality({ aws: aws(world()), now: NOW });
  const q = Q.buildQuality({ pull, prev: null, now: NOW });
  assert.equal(q.day, DAY);
  assert.equal(q.pulledAt, '2026-11-05T00:20:00.000Z');
  assert.match(q.note, /nothing here is estimated/);
  assert.equal(Q.buildQuality({ pull: null, prev: { quality: q }, now: NOW + 3600000 }), q);
  const base = { usage: { rows: [], error: null }, cost: null, readers: null, raw: {}, prices, now: NOW };
  assert.equal(buildOps({ ...base, quality: pull, prev: null }).quality.day, DAY);
  assert.equal(buildOps({ ...base, prev: { quality: q } }).quality.day, DAY);
  assert.equal(buildOps({ ...base, prev: null }).quality, null);
});

test('run: the quality section is written into ops.json once, reused within the day, and skipQuality leaves it out', async () => {
  const files = world();
  const puts = [];
  let scans = 0;
  const full = () => ({
    ...aws(files),
    clientErrorRows: async () => { scans += 1; return []; },
    putJson: async (k, o) => { puts.push([k, o]); },
    resolverStatus: async () => ({ sampled: 1, due: 0, drafted: 0, verdicts: 0, commits: [] }),
    lambdaErrors: async () => ({}), compareCounts: async () => ({}), usageRows: async () => [], costByService: async () => [],
  });
  const first = await run({ aws: full(), now: NOW, log: () => {} });
  assert.equal(first.ops.quality.day, DAY);
  assert.equal(scans, 1);
  assert.ok(puts.some(([k, o]) => k === 'monitoring/ops.json' && o.quality.day === DAY));
  files['monitoring/ops.json'] = JSON.stringify(first.ops);
  const second = await run({ aws: full(), now: NOW + 3600000, log: () => {} });
  assert.equal(scans, 1);
  assert.equal(second.ops.quality.pulledAt, first.ops.quality.pulledAt);
  delete files['monitoring/ops.json'];
  const skipped = await run({ aws: full(), now: NOW, skipQuality: true, dry: true, log: () => {} });
  assert.equal(skipped.ops.quality, null);
});
