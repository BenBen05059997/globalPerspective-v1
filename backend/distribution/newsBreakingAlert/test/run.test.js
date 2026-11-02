'use strict';
// newsBreakingAlert handler (run()): candidate selection, the dedupe window, the proposal row, the operator email and its failure branches.
// Scoring (significance.js) and rendering (render.js) have their own tests; here the real ones run on small fixtures. Offline: stubAws answers DynamoDB from
// an in-memory fake, global fetch is a fake Resend, and the clock is not faked (dedupe ages are relative to now).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws } = require('../../../shared/test/stubAws');

const INDEX = path.resolve(__dirname, '../src/index.js');
const DAY = 86400000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();

// A strong, new story: 3 topics x 4 distinct outlets, no prior thread -> score well above the 2.0 threshold.
const outlets = (n, tag) => Array.from({ length: n }, (_, i) => ({ source: `${tag}-outlet-${i}`, title: `${tag} headline ${i}`, url: `https://${tag}${i}.example/a` }));
const strong = (id, { sources = 4, extra = {} } = {}) => [1, 2, 3].map((n) => ({ topicId: `${id}-${n}`, threadId: id, title: `Story ${id} angle ${n}`, category: 'conflict', regions: [], sources: outlets(sources, `${id}${n}`), ...extra }));
// A weak one: a single topic, one source.
const weak = (id) => [{ topicId: id, title: `Quiet ${id}`, category: 'society', regions: [], sources: outlets(1, id) }];

function makeStore() {
  const s = { topics: [], rows: {}, alerts: {}, puts: [], updates: [], getTopicsThrows: false };
  s.ddb = (input, cmd) => {
    if (cmd === 'GetCommand') {
      if (input.TableName === 'TopicsT') {
        if (s.getTopicsThrows) throw new Error('topics read failed');
        return { Item: { id: 'latest', topics: s.topics } };
      }
      if (input.TableName === 'GlobalPerspectiveBreakingAlerts') return { Item: s.alerts[input.Key.alertKey] };
      if (input.TableName === 'SummT') return { Item: s.rows[`${input.Key.PK}|${input.Key.SK}`] };
    }
    if (cmd === 'PutCommand') {
      if (s.putThrows) throw new Error('put failed');
      s.puts.push(input.Item); s.alerts[input.Item.alertKey] = input.Item; return {};
    }
    if (cmd === 'UpdateCommand') { s.updates.push(input); return {}; }
    throw new Error(`unexpected ${cmd} on ${input.TableName}`);
  };
  return s;
}

const ENV = {
  TOPICS_DDB_TABLE: 'TopicsT', SUMMARIZE_PREDICT_TABLE: 'SummT', BREAKING_ALERTS_TABLE: undefined,
  DRY_RUN: undefined, RESEND_API_KEY: undefined, ALERT_EMAIL_TO: 'ops@example.test', ALERT_EMAIL_FROM: 'alerts@example.test',
  SITE_URL: 'https://site.example', RECORD_READS: undefined, NOTES_READS: undefined, SIGNIFICANCE_THRESHOLD: undefined, DEDUPE_DAYS: undefined, DEDUPE_TTL_DAYS: undefined,
};

async function withRun(env, fill, fn, resendStatus = 200) {
  const store = makeStore();
  fill(store);
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, auth: opts.headers.Authorization, ...JSON.parse(opts.body) });
    return resendStatus === 200
      ? { ok: true, status: 200, text: async () => '{"id":"resend-1"}' }
      : { ok: false, status: resendStatus, text: async () => '{"message":"rejected"}' };
  };
  const realConsole = [console.log, console.warn, console.error];
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  const aws = stubAws({ ddb: store.ddb });
  try {
    const mod = aws.load(INDEX, { ...ENV, ...env });
    return await fn(mod.handler, { store, calls });
  } finally {
    aws.restore();
    globalThis.fetch = realFetch;
    [console.log, console.warn, console.error] = realConsole;
  }
}

test('nothing clears the threshold: no proposal row, no email, reason no_candidate', async () => {
  await withRun({ DRY_RUN: 'false', RESEND_API_KEY: 'k' }, (s) => { s.topics = [...weak('a'), ...weak('b')]; }, async (handler, { store, calls }) => {
    assert.deepEqual(await handler(), { ok: true, proposed: 0, reason: 'no_candidate' });
    assert.equal(store.puts.length + store.updates.length + calls.length, 0);
  });
});

test('an empty topic pool is quiet too (no latest topics is not an error)', async () => {
  await withRun({}, (s) => { s.topics = []; }, async (handler) => {
    assert.deepEqual(await handler(), { ok: true, proposed: 0, reason: 'no_candidate' });
  });
});

test('DRY_RUN (the default): writes the proposal row, marks it dryRun, sends nothing and does not mark it sent', async () => {
  await withRun({}, (s) => {
    s.topics = [...strong('big'), ...weak('quiet')];
    s.rows['TOPIC#big-1|SUMMARY'] = { content: '## What happened\nSomething.', contentFormat: 'markdown' };
    s.rows['TOPIC#big-1|PREDICTION'] = { content: '{"raw":"json"}', contentFormat: 'json' };
    s.rows['TOPIC#big-1|TRACE_CAUSE'] = { content: JSON.stringify({ proximate: 'A trigger' }) };
  }, async (handler, { store, calls }) => {
    const before = Date.now();
    const r = await handler();
    assert.equal(r.ok, true);
    assert.equal(r.proposed, 1);
    assert.equal(r.sent, false);
    assert.equal(r.dryRun, true);
    assert.equal(r.threadId, 'big');
    assert.equal(calls.length, 0);
    assert.equal(store.updates.length, 0);
    assert.equal(store.puts.length, 1);
    const row = store.puts[0];
    assert.equal(row.alertKey, r.threadId);
    assert.equal(row.status, 'proposed');
    assert.equal(row.sent, false);
    assert.equal(row.dryRun, true);
    assert.equal(row.score, r.score);
    assert.ok(row.score >= 2);
    assert.ok(row.reasons.includes('12 sources'));
    assert.equal(row.title, 'Story big angle 1');
    assert.equal(row.category, 'conflict');
    assert.equal(row.leadTopicId, 'big-1');
    assert.equal(row.threadId, 'big');
    assert.equal(row.hasArc, false); // a thread id but no thread analysis row: no arc link
    assert.equal(row.sourceCount, 12); // summed over the story's 3 topics
    assert.equal(row.outletCount, 4); // distinct outlets of the lead topic
    assert.equal(row.story.summary, '## What happened\nSomething.');
    assert.equal(row.story.prediction, '', 'a JSON-format prediction is never surfaced');
    assert.deepEqual(row.story.traceCause, { proximate: 'A trigger' });
    assert.equal(row.story.sources.length, 4);
    assert.deepEqual(row.verify, { status: 'pending', note: 'LLM verify not yet wired (Phase 3)' });
    assert.equal(typeof row.draft.subject, 'string');
    assert.ok(row.draft.subject.length > 0);
    assert.ok(row.draft.text.length > 0 && row.draft.html.length > 0);
    assert.ok(Date.parse(row.alertedAt) >= before - 1000 && Date.parse(row.alertedAt) <= Date.now() + 1000);
    assert.equal(row.cycle, row.alertedAt);
    assert.ok(Math.abs(row.ttl - Math.floor((Date.parse(row.alertedAt) + 14 * DAY) / 1000)) <= 1, 'ttl is 14 days after the alert');
  });
});

test('topics sharing a threadId are one story: one proposal keyed by the thread, with the lead topic being the one with most sources', async () => {
  await withRun({}, (s) => {
    s.topics = [
      { topicId: 't1', threadId: 'thr-1', title: 'Small angle', category: 'conflict', regions: [], sources: outlets(2, 'a') },
      { topicId: 't2', threadId: 'thr-1', title: 'Biggest angle', category: 'conflict', regions: [], sources: outlets(6, 'b') },
      { topicId: 't3', threadId: 'thr-1', title: 'Third angle', category: 'conflict', regions: [], sources: outlets(3, 'c') },
    ];
    s.rows['THREAD#thr-1|THREAD_ANALYSIS'] = { threadTitle: 'The thread title' }; // a real thread arc, not a continuation (no entryCount)
  }, async (handler, { store }) => {
    const r = await handler();
    assert.equal(r.threadId, 'thr-1');
    const row = store.puts[0];
    assert.equal(row.alertKey, 'thr-1');
    assert.equal(row.threadId, 'thr-1');
    assert.equal(row.hasArc, true);
    assert.equal(row.title, 'The thread title');
    assert.equal(row.leadTopicId, 't2');
    assert.equal(row.sourceCount, 11);
  });
});

test('topics without a threadId each stand alone, keyed by their own topic id, and an un-threaded story has no thread on the row', async () => {
  await withRun({ SIGNIFICANCE_THRESHOLD: '1.2' }, (s) => {
    s.topics = [{ topicId: 'solo', title: 'Solo story', category: 'conflict', regions: [], sources: outlets(12, 'solo') }];
  }, async (handler, { store }) => {
    const r = await handler();
    assert.equal(r.threadId, 'solo');
    assert.equal(store.puts[0].alertKey, 'solo');
    assert.equal(store.puts[0].threadId, null);
    assert.equal(store.puts[0].hasArc, false);
  });
});

test('at most one story per run: the highest-scoring of several candidates is proposed', async () => {
  await withRun({}, (s) => { s.topics = [...strong('mid', { sources: 2 }), ...strong('top', { sources: 6 })]; }, async (handler, { store }) => {
    const r = await handler();
    assert.equal(r.threadId, 'top');
    assert.equal(store.puts.length, 1);
  });
});

test('dedupe: a story alerted within the last 5 days is skipped in favour of the next candidate; an older alert does not block', async () => {
  const fill = (ageDays) => (s) => {
    s.topics = [...strong('mid', { sources: 2 }), ...strong('top', { sources: 6 })];
    s.alerts['top'] = { alertKey: 'top', status: 'confirmed', alertedAt: iso(ageDays) };
  };
  await withRun({}, fill(1), async (handler, { store }) => {
    const r = await handler();
    assert.equal(r.threadId, 'mid');
    assert.equal(store.puts[0].alertKey, 'mid');
  });
  await withRun({}, fill(6), async (handler) => {
    assert.equal((await handler()).threadId, 'top');
  });
});

test('dedupe: when every candidate was alerted recently nothing is written or sent (reason all_deduped)', async () => {
  await withRun({ DRY_RUN: 'false', RESEND_API_KEY: 'k' }, (s) => {
    s.topics = strong('top');
    s.alerts['top'] = { alertKey: 'top', status: 'proposed', alertedAt: iso(0.5) };
  }, async (handler, { store, calls }) => {
    assert.deepEqual(await handler(), { ok: true, proposed: 0, reason: 'all_deduped' });
    assert.equal(store.puts.length + calls.length, 0);
  });
});

test('dedupe window follows DEDUPE_DAYS', async () => {
  await withRun({ DEDUPE_DAYS: '10' }, (s) => { s.topics = strong('top'); s.alerts['top'] = { alertKey: 'top', alertedAt: iso(6) }; }, async (handler) => {
    assert.equal((await handler()).reason, 'all_deduped');
  });
});

test('a story that already has a thread analysis faces the raised bar (2 x 1.8): not proposed at score ~2.6; the same story with no prior entries is', async () => {
  const fill = (entryCount) => (s) => {
    s.topics = strong('c', { extra: { threadId: 'thr-c' } });
    s.rows['THREAD#thr-c|THREAD_ANALYSIS'] = { threadTitle: 'Ongoing', entryCount };
  };
  await withRun({}, fill(1), async (handler, { store }) => { // 2 new angles: score ~2.6 clears 2.0 but not the continuation bar 2 * 1.8
    assert.equal((await handler()).reason, 'no_candidate');
    assert.equal(store.puts.length, 0);
  });
  await withRun({}, fill(0), async (handler) => { // no prior entries: a new story, bar 2.0
    assert.equal((await handler()).proposed, 1);
  });
});

test('a topic marked continues_topic is a continuation even without a thread analysis', async () => {
  // 3 topics x 4 sources, velocity 3: score ~2.8, clears 2.0 but not 3.6
  await withRun({}, (s) => { s.topics = strong('k', { extra: { continues_topic: 'older' } }); }, async (handler) => {
    assert.equal((await handler()).reason, 'no_candidate');
  });
  await withRun({}, (s) => { s.topics = strong('k'); }, async (handler) => {
    assert.equal((await handler()).proposed, 1);
  });
});

test('region risk tilts the score: a weak story in a high-risk, fresh country clears the bar; a stale country record does not count', async () => {
  const topics = () => [1, 2].map((n) => ({ topicId: `r-${n}`, threadId: 'r', title: `R ${n}`, category: 'conflict', regions: ['Iran'], sources: outlets(5, `r${n}`) }));
  const country = (ageDays) => ({ riskScore: 80, riskLevel: 'high', generatedAt: iso(ageDays), dimensions: { conflict: 80, political: 80, economic: 80, humanitarian: 80 } });
  await withRun({ SIGNIFICANCE_THRESHOLD: '2.3' }, (s) => { s.topics = topics(); s.rows['COUNTRY#Iran|COUNTRY_INTELLIGENCE'] = country(2); }, async (handler) => {
    assert.equal((await handler()).proposed, 1);
  });
  await withRun({ SIGNIFICANCE_THRESHOLD: '2.3' }, (s) => { s.topics = topics(); s.rows['COUNTRY#Iran|COUNTRY_INTELLIGENCE'] = country(40); }, async (handler) => {
    assert.equal((await handler()).reason, 'no_candidate');
  });
});

test('live send: emails ALERT_EMAIL_TO a copy flagged unconfirmed, then flips the row to status sent', async () => {
  await withRun({ DRY_RUN: 'false', RESEND_API_KEY: 'live-key' }, (s) => { s.topics = strong('big'); }, async (handler, { store, calls }) => {
    const r = await handler();
    assert.deepEqual([r.ok, r.proposed, r.sent, r.to, r.threadId], [true, 1, true, 'ops@example.test', 'big']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.resend.com/emails');
    assert.equal(calls[0].auth, 'Bearer live-key');
    assert.equal(calls[0].from, 'alerts@example.test');
    assert.deepEqual(calls[0].to, ['ops@example.test']);
    assert.match(calls[0].subject, /^\[Unconfirmed\] /);
    assert.match(calls[0].text, /^NOT PUBLIC YET/);
    assert.match(calls[0].text, /alert id big\b/);
    // the stored draft stays the plain alert (no operator notice); the row is first written as proposed with dryRun false
    assert.equal(store.puts[0].status, 'proposed');
    assert.equal(store.puts[0].dryRun, false);
    assert.doesNotMatch(store.puts[0].draft.subject, /Unconfirmed/);
    assert.equal(store.updates.length, 1);
    assert.equal(store.updates[0].TableName, 'GlobalPerspectiveBreakingAlerts');
    assert.deepEqual(store.updates[0].Key, { alertKey: 'big' });
    assert.equal(store.updates[0].ExpressionAttributeValues[':sent'], 'sent');
    assert.equal(store.updates[0].ExpressionAttributeValues[':true'], true);
  });
});

test('live but RESEND_API_KEY unset: the proposal is kept, nothing is sent, and the result says no_key (no throw)', async () => {
  await withRun({ DRY_RUN: 'false' }, (s) => { s.topics = strong('big'); }, async (handler, { store, calls }) => {
    const r = await handler();
    assert.deepEqual([r.ok, r.proposed, r.sent, r.reason], [true, 1, false, 'no_key']);
    assert.equal(store.puts.length, 1);
    assert.equal(calls.length + store.updates.length, 0);
  });
});

test('DRY_RUN is only off for the exact string "false"', async () => {
  await withRun({ DRY_RUN: 'FALSE', RESEND_API_KEY: 'k' }, (s) => { s.topics = strong('big'); }, async (handler, { calls }) => {
    assert.equal((await handler()).dryRun, true);
    assert.equal(calls.length, 0);
  });
});

test('Resend rejecting the email: the proposal row stays proposed (not marked sent) and the result carries the error', async () => {
  await withRun({ DRY_RUN: 'false', RESEND_API_KEY: 'k' }, (s) => { s.topics = strong('big'); }, async (handler, { store, calls }) => {
    const r = await handler();
    assert.equal(r.ok, true);
    assert.equal(r.proposed, 1);
    assert.equal(r.sent, false);
    assert.match(r.error, /Resend send failed \(422\)/);
    assert.equal(calls.length, 1);
    assert.equal(store.updates.length, 0);
    assert.equal(store.alerts['big'].status, 'proposed');
  }, 422);
});

test('a failed send leaves the dedupe row, so the same story is not proposed again on the next run (current behaviour)', async () => {
  await withRun({ DRY_RUN: 'false', RESEND_API_KEY: 'k' }, (s) => { s.topics = strong('big'); }, async (handler, { calls }) => {
    await handler();
    assert.equal((await handler()).reason, 'all_deduped');
    assert.equal(calls.length, 1);
  }, 500);
});

test('a failed proposal write sends no email, logs [pipeline-status] failed and rejects the invocation', async () => {
  await withRun({ DRY_RUN: 'false', RESEND_API_KEY: 'k' }, (s) => { s.topics = strong('big'); s.putThrows = true; }, async (handler, { store, calls }) => {
    const logged = [];
    console.error = (...a) => logged.push(a.map(String).join(' '));
    await assert.rejects(handler(), { message: 'put failed' });
    assert.equal(calls.length, 0);
    assert.equal(store.puts.length, 0);
    assert.equal(store.updates.length, 0);
    const marker = logged.find((l) => l.startsWith('[pipeline-status] '));
    assert.deepEqual(JSON.parse(marker.slice('[pipeline-status] '.length)), { status: 'failed', reason: 'proposal-write-failed', threadId: 'big', error: 'put failed' });
  });
});

test('a failure reading the topic pool comes back as { ok: false, error } (the Lambda reports, it does not throw)', async () => {
  await withRun({}, (s) => { s.getTopicsThrows = true; }, async (handler) => {
    assert.deepEqual(await handler(), { ok: false, error: 'topics read failed' });
  });
});
