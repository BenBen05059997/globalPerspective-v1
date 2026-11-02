'use strict';
// newsCountryFactsUpdater handler paths beyond the Japan / Iran happy cases (handler.test.js): a failed source, a missing field, an
// existing record, ACLED, the time budget. Wikidata, ACLED and DynamoDB are fakes; the facts are shown on country pages with source and date,
// so what matters is: a failed source never erases a good old value, nothing undated or unlabelled is invented, one country failing never stops the rest.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { withLambda, fakeDdb, fakeS3 } = require('../../../shared/test/pipelineHarness');

const INDEX = path.resolve(__dirname, '../src/index.js');
const ENV = { SUMMARIZE_PREDICT_TABLE: 'summary', ACLED_USERNAME: undefined, ACLED_PASSWORD: undefined, NOTES_PREFIX: undefined, FACTS_TIME_BUDGET_MS: undefined, WORLD_BUCKET: 'bkt' };
const WD = 'http://www.wikidata.org/entity/';
const LABELS = { Q1: 'Alice Head', Q2: 'Bob Gov' };

// Wikidata + ACLED over a fake `https`. `override(info)` may answer first: return { status, body } (object bodies are JSON-encoded) or throw to simulate a network error.
function fakeHttps(override = () => undefined) {
  const calls = [];
  const qidsIn = (q) => [...q.matchAll(/wd:(Q\d+)/g)].map((m) => m[1]);
  const answer = (info) => {
    const o = override(info);
    if (o) return o;
    const { hostname, q, path: p } = info;
    if (hostname === 'acleddata.com') return { status: 404, body: '{}' };
    const label = /Special:EntityData\/(Q\d+)/.exec(p);
    if (label) return { status: 200, body: { entities: { [label[1]]: { labels: { en: { value: LABELS[label[1]] || label[1] } } } } } };
    if (/P298/.test(q)) return { status: 200, body: { results: { bindings: [...q.matchAll(/"([A-Z]{3})"/g)].map((m) => ({ iso: { value: m[1] }, c: { value: `${WD}Q9${m[1].charCodeAt(0)}${m[1].charCodeAt(1)}${m[1].charCodeAt(2)}` } })) } } };
    if (/p:P36/.test(q)) return { status: 200, body: { results: { bindings: qidsIn(q).map((id) => ({ c: { value: WD + id }, capLabel: { value: `Capital of ${id}` } })) } } };
    if (/P1082/.test(q)) return { status: 200, body: { results: { bindings: qidsIn(q).map((id) => ({ c: { value: WD + id }, pop: { value: '5000000' }, time: { value: '2024-01-01T00:00:00Z' } })) } } };
    return { status: 200, body: { results: { bindings: [ // leadership
      { role: { value: 'head_of_state' }, officeholder: { value: `${WD}Q1` }, startTime: { value: '2024-05-01T00:00:00Z' } },
      { role: { value: 'head_of_government' }, officeholder: { value: `${WD}Q2` }, startTime: { value: '2025-10-21T00:00:00Z' } },
    ] } } };
  };
  const respond = (req, opts, cb, extra) => setImmediate(() => {
    let r;
    try {
      const q = decodeURIComponent(opts.path || '');
      const info = { hostname: opts.hostname, path: opts.path || '', q, method: opts.method || 'GET', ...extra };
      calls.push(info);
      r = answer(info);
    } catch (err) { req.emit('error', err); return; }
    const res = new EventEmitter();
    res.statusCode = r.status; res.headers = {};
    cb(res);
    res.emit('data', typeof r.body === 'string' ? r.body : JSON.stringify(r.body));
    res.emit('end');
  });
  return {
    calls,
    get: (opts, cb) => { const req = new EventEmitter(); respond(req, opts, cb); return req; },
    request: (opts, cb) => { const req = new EventEmitter(); let sent = ''; req.write = (b) => { sent += b; }; req.end = () => respond(req, opts, cb, { form: new URLSearchParams(sent) }); return req; },
  };
}
const wdCalls = (https, re) => https.calls.filter((c) => c.hostname === 'query.wikidata.org' && re.test(c.q));

async function run({ https = fakeHttps(), ddb = fakeDdb(), s3 = fakeS3(), env = {} }, event, body) {
  const originalTimeout = global.setTimeout;
  global.setTimeout = (fn, ms, ...a) => originalTimeout(fn, 0, ...a); // the handler paces itself with 600 ms sleeps
  try {
    return await withLambda(INDEX, { env: { ...ENV, ...env }, ddb, s3, https }, async (ctx) => {
      const out = ctx.mod.handler(event);
      return body({ ...ctx, https, ddb, s3 }, out);
    });
  } finally { global.setTimeout = originalTimeout; }
}
const facts = (ddb, name) => ddb.store.get(`FACTS#${name}|COUNTRY_FACTS`);
const existing = (name, f) => ({ PK: `FACTS#${name}`, SK: 'COUNTRY_FACTS', countryName: name, lastUpdatedAt: '2026-09-01T00:00:00.000Z', ...f });

// ─── capital and population: a failed source keeps the old value ──────────────────────

test('a failed capital query keeps the stored capital with its OLD checkedAt while the population refreshes; a failed population query likewise', async () => {
  const oldCap = { names: ['Old Capital'], source: 'wikidata', checkedAt: '2026-08-01T00:00:00.000Z' };
  const oldPop = { value: 1, year: 2020, time: '2020-01-01', source: 'wikidata', checkedAt: '2026-08-01T00:00:00.000Z' };
  for (const [failing, kept, fresh] of [[/p:P36/, 'capital', 'population'], [/P1082/, 'population', 'capital']]) {
    const ddb = fakeDdb([existing('Japan', { capital: oldCap, population: oldPop })]);
    const https = fakeHttps((i) => (i.hostname === 'query.wikidata.org' && failing.test(i.q) ? { status: 500, body: 'boom' } : undefined));
    await run({ https, ddb }, { countries: ['Japan'] }, async ({ logs }, out) => {
      const r = JSON.parse((await out).body);
      assert.deepEqual(r.updated, ['Japan']);
      assert.deepEqual(r.failed, []);
      // pinned: the report counts a country as lacking the fact when THIS run could not fetch it, even though the old value was kept
      assert.deepEqual(r[kept === 'capital' ? 'noCapital' : 'noPopulation'], ['Japan']);
      assert.ok(logs.error.some((l) => /(capital|population) query failed: Wikidata 500/.test(l)), logs.error.join('\n'));
    });
    const row = facts(ddb, 'Japan');
    assert.deepEqual(row[kept], kept === 'capital' ? oldCap : oldPop, `${kept} kept untouched`);
    assert.notEqual(row[fresh].checkedAt, '2026-08-01T00:00:00.000Z', `${fresh} refreshed`);
    assert.equal(row[fresh].source, 'wikidata');
  }
});

test('no capital or population in Wikidata and none stored: the fields are absent (nothing invented), and the country is reported as lacking them', async () => {
  const https = fakeHttps((i) => (i.hostname === 'query.wikidata.org' && (/p:P36/.test(i.q) || /P1082/.test(i.q)) ? { status: 200, body: { results: { bindings: [] } } } : undefined));
  const ddb = fakeDdb();
  await run({ https, ddb }, { countries: ['Japan'] }, async (_, out) => {
    const r = JSON.parse((await out).body);
    assert.deepEqual([r.updated, r.noCapital, r.noPopulation], [['Japan'], ['Japan'], ['Japan']]);
  });
  const row = facts(ddb, 'Japan');
  assert.equal('capital' in row, false);
  assert.equal('population' in row, false);
  assert.ok(row.lastUpdatedAt);
});

test('unusable Wikidata rows are dropped: an unlabelled capital (bare QID), a former capital, an undated population, a non-positive population', async () => {
  const https = fakeHttps((i) => {
    if (i.hostname !== 'query.wikidata.org') return undefined;
    if (/P298/.test(i.q)) return { status: 200, body: { results: { bindings: [{ iso: { value: 'JPN' }, c: { value: `${WD}Q17` } }] } } };
    if (/p:P36/.test(i.q)) return { status: 200, body: { results: { bindings: [
      { c: { value: `${WD}Q17` }, capLabel: { value: 'Q12345' } },
      { c: { value: `${WD}Q17` }, capLabel: { value: 'Kyoto' }, end: { value: '1868-01-01T00:00:00Z' } },
    ] } } };
    if (/P1082/.test(i.q)) return { status: 200, body: { results: { bindings: [
      { c: { value: `${WD}Q17` }, pop: { value: '123000000' } },
      { c: { value: `${WD}Q17` }, pop: { value: '-5' }, time: { value: '2024-01-01T00:00:00Z' } },
    ] } } };
    return undefined;
  });
  const ddb = fakeDdb();
  await run({ https, ddb }, { countries: ['Japan'] }, async (_, out) => { await out; });
  const row = facts(ddb, 'Japan');
  assert.equal(row.capital, undefined);
  assert.equal(row.population, undefined);
});

test('an ISO3 Wikidata cannot resolve (lookup fails, or the code is missing from the answer) fails that country only; nothing is written for it', async () => {
  // lookup fails for everyone
  const down = fakeHttps((i) => (i.hostname === 'query.wikidata.org' && /P298/.test(i.q) ? { status: 503, body: 'x' } : undefined));
  const ddb = fakeDdb();
  await run({ https: down, ddb }, { countries: ['Japan', 'Iran'] }, async ({ logs }, out) => {
    const r = JSON.parse((await out).body);
    assert.deepEqual(r.failed, ['Japan']);
    assert.deepEqual(r.updated, ['Iran']); // Iran carries its own QID
    assert.ok(logs.error.some((l) => /QID lookup failed: Wikidata 503/.test(l)));
    assert.ok(logs.error.some((l) => /No Wikidata QID for Japan/.test(l)));
  });
  assert.equal(facts(ddb, 'Japan'), undefined);
  assert.ok(facts(ddb, 'Iran'));

  // the lookup works but omits one code
  const partial = fakeHttps((i) => {
    if (!(i.hostname === 'query.wikidata.org' && /P298/.test(i.q))) return undefined;
    return { status: 200, body: { results: { bindings: [{ iso: { value: 'FRA' }, c: { value: `${WD}Q142` } }] } } };
  });
  const ddb2 = fakeDdb();
  await run({ https: partial, ddb: ddb2 }, { countries: ['Japan', 'France'] }, async (_, out) => {
    const r = JSON.parse((await out).body);
    assert.deepEqual([r.updated, r.failed], [['France'], ['Japan']]);
  });
});

test('capital and population are fetched in batches of 25 countries for the whole list, not one query per country', async () => {
  const https = fakeHttps();
  const ddb = fakeDdb();
  await run({ https, ddb }, {}, async (_, out) => {
    const r = JSON.parse((await out).body);
    assert.equal(r.updated.length, 40);
    assert.deepEqual([r.failed, r.skipped, r.noCapital, r.noPopulation], [[], [], [], []]);
  });
  assert.equal(wdCalls(https, /p:P36/).length, 2);
  assert.equal(wdCalls(https, /P1082/).length, 2);
  assert.equal(wdCalls(https, /P298/).length, 1);
  assert.equal(wdCalls(https, /p:P35/).length, 12, 'leadership is fetched one by one, and only for the original 12');
  assert.equal(ddb.puts.length, 40);
});

// ─── leadership (the original 12) ─────────────────────────────────────────────────────

test('leadership string: one person in both offices is "Head of State and Government"; two people list both; a missing start date reads "since ?"; one office alone is just that office', async () => {
  const cases = [
    [[['head_of_state', 'Q1', '2024-05-01T00:00:00Z'], ['head_of_government', 'Q1', '2024-05-01T00:00:00Z']], 'Alice Head (Head of State and Government, since 2024-05-01)'],
    [[['head_of_state', 'Q1', '2024-05-01T00:00:00Z'], ['head_of_government', 'Q2', '2025-10-21T00:00:00Z']], 'Head of State: Alice Head (since 2024-05-01). Head of Government: Bob Gov (since 2025-10-21)'],
    [[['head_of_government', 'Q2', undefined]], 'Head of Government: Bob Gov (since ?)'],
    [[['head_of_state', 'Q1', '2024-05-01T00:00:00Z']], 'Head of State: Alice Head (since 2024-05-01)'],
  ];
  for (const [rows, want] of cases) {
    const https = fakeHttps((i) => (i.hostname === 'query.wikidata.org' && /p:P35/.test(i.q)
      ? { status: 200, body: { results: { bindings: rows.map(([role, q, t]) => ({ role: { value: role }, officeholder: { value: WD + q }, ...(t ? { startTime: { value: t } } : {}) })) } } } : undefined));
    const ddb = fakeDdb();
    await run({ https, ddb }, { countries: ['Iran'] }, async (_, out) => { await out; });
    const row = facts(ddb, 'Iran');
    assert.equal(row.leadershipString, want);
    assert.equal(row.leadershipSource, 'wikidata');
  }
});

test('an officeholder whose label cannot be read is shown by its QID (never dropped or guessed)', async () => {
  const https = fakeHttps((i) => (/Special:EntityData/.test(i.path) ? { status: 500, body: 'not json' } : undefined));
  const ddb = fakeDdb();
  await run({ https, ddb }, { countries: ['Iran'] }, async (_, out) => { await out; });
  assert.equal(facts(ddb, 'Iran').leadershipString, 'Head of State: Q1 (since 2024-05-01). Head of Government: Q2 (since 2025-10-21)');
});

test('leadership change: a different stored string marks the country and stamps leadershipChangedAt; the same string keeps the old stamp; a first record is not a change', async () => {
  const current = 'Head of State: Alice Head (since 2024-05-01). Head of Government: Bob Gov (since 2025-10-21)';
  const changed = fakeDdb([existing('Iran', { leadershipString: 'Head of Government: Old Person (since 2020-01-01)', leadershipChangedAt: '2025-01-01T00:00:00.000Z' })]);
  await run({ ddb: changed }, { countries: ['Iran'] }, async (_, out) => {
    const r = JSON.parse((await out).body);
    assert.deepEqual(r.leadershipChanges, ['Iran']);
  });
  assert.ok(Date.parse(facts(changed, 'Iran').leadershipChangedAt) > Date.now() - 60000);

  const same = fakeDdb([existing('Iran', { leadershipString: current, leadershipChangedAt: '2025-01-01T00:00:00.000Z' })]);
  await run({ ddb: same }, { countries: ['Iran'] }, async (_, out) => assert.deepEqual(JSON.parse((await out).body).leadershipChanges, []));
  assert.equal(facts(same, 'Iran').leadershipChangedAt, '2025-01-01T00:00:00.000Z');

  const first = fakeDdb();
  await run({ ddb: first }, { countries: ['Iran'] }, async (_, out) => assert.deepEqual(JSON.parse((await out).body).leadershipChanges, []));
  assert.equal(facts(first, 'Iran').leadershipChangedAt, null);
});

test('a failed leadership source fails that country (the old record stays untouched) and the next country is still updated', async () => {
  const old = existing('Iran', { leadershipString: 'Old Person', capital: { names: ['Tehran'] } });
  const ddb = fakeDdb([old]);
  const https = fakeHttps((i) => (i.hostname === 'query.wikidata.org' && /p:P35/.test(i.q) && /Q794/.test(i.q) ? { status: 500, body: 'Internal Server Error' } : undefined));
  await run({ https, ddb }, { countries: ['Iran', 'Israel'] }, async ({ logs }, out) => {
    const r = JSON.parse((await out).body);
    assert.deepEqual([r.updated, r.failed], [['Israel'], ['Iran']]);
    assert.ok(logs.error.some((l) => /Failed to update Iran/.test(l)));
  });
  assert.deepEqual(facts(ddb, 'Iran'), old);
  assert.ok(facts(ddb, 'Israel').leadershipString);
});

test('a DynamoDB write failure fails that country only', async () => {
  const ddb = fakeDdb([], { fail: (name, input) => (name === 'PutCommand' && input.Item.PK === 'FACTS#Japan' ? new Error('throttled') : null) });
  await run({ ddb }, { countries: ['Japan', 'France'] }, async (_, out) => {
    const r = JSON.parse((await out).body);
    assert.deepEqual([r.updated, r.failed], [['France'], ['Japan']]);
  });
  assert.equal(facts(ddb, 'Japan'), undefined);
  assert.ok(facts(ddb, 'France'));
});

test('a failed read of the stored record counts as "no previous record" (capital/population are then simply fresh)', async () => {
  const ddb = fakeDdb([], { fail: (name) => (name === 'GetCommand' ? new Error('read failed') : null) });
  await run({ ddb }, { countries: ['Japan'] }, async (_, out) => assert.deepEqual(JSON.parse((await out).body).updated, ['Japan']));
  assert.equal(facts(ddb, 'Japan').capital.source, 'wikidata');
});

// ─── ACLED ──────────────────────────────────────────────────────────────────────

const TOKEN_OK = { status: 200, body: { access_token: 'tok' } };
const acled = (events, over = {}) => (i) => {
  if (i.hostname !== 'acleddata.com') return undefined;
  if (i.method === 'POST') return over.token || TOKEN_OK;
  return over.read || { status: 200, body: { data: events } };
};
const CREDS = { ACLED_USERNAME: 'u@example.com', ACLED_PASSWORD: 'pw' };

test('with ACLED credentials the 30 day conflict activity is stored: event count, fatalities, the top actor pairs and the latest event (trimmed), with source and retrieval time', async () => {
  const events = [
    { event_date: '2026-10-30', fatalities: '3', actor1: 'Army', actor2: 'Rebels', notes: 'x'.repeat(300) },
    { event_date: '2026-10-29', fatalities: 'n/a', actor1: 'Army', actor2: 'Rebels' },
    { event_date: '2026-10-28', fatalities: '4', actor1: 'Militia' },
    { event_date: '2026-10-27', fatalities: '0', actor1: 'A', actor2: 'B' },
    { event_date: '2026-10-26', fatalities: '1', actor1: 'C', actor2: 'D' },
  ];
  const https = fakeHttps(acled(events));
  const ddb = fakeDdb();
  await run({ https, ddb, env: CREDS }, { countries: ['Iran'] }, async (_, out) => { await out; });
  const a = facts(ddb, 'Iran').acledData;
  assert.equal(a.eventCount30d, 5);
  assert.equal(a.fatalities30d, 8);
  assert.equal(a.latestEventDate, '2026-10-30');
  assert.equal(a.latestEventSummary, 'x'.repeat(200));
  assert.deepEqual(a.dominantActors, ['Army vs Rebels', 'Militia', 'A vs B']);
  assert.equal(a.source, 'ACLED');
  assert.ok(Date.parse(a.retrievedAt) > Date.now() - 60000);
  const post = https.calls.find((c) => c.method === 'POST');
  assert.equal(post.form.get('username'), 'u@example.com');
  assert.equal(post.form.get('grant_type'), 'password');
  const read = https.calls.find((c) => /\/api\/acled\/read/.test(c.path));
  assert.match(read.path, /country=Iran/);
});

test('no events in the window is stored as zero events (a quiet month is a fact), without invented detail', async () => {
  const ddb = fakeDdb();
  await run({ https: fakeHttps(acled([])), ddb, env: CREDS }, { countries: ['Iran'] }, async (_, out) => { await out; });
  const a = facts(ddb, 'Iran').acledData;
  assert.deepEqual([a.eventCount30d, a.fatalities30d, a.source], [0, 0, 'ACLED']);
  assert.equal(a.latestEventSummary, undefined);
});

test('without credentials, or when ACLED login or read fails, the previously stored ACLED data is kept; a failed login is not retried for every country', async () => {
  const old = { eventCount30d: 99, fatalities30d: 1, source: 'ACLED', retrievedAt: '2026-09-01T00:00:00.000Z' };
  const store = () => fakeDdb([existing('Iran', { acledData: old }), existing('Israel', { acledData: old })]);

  const noCreds = store();
  await run({ ddb: noCreds }, { countries: ['Iran'] }, async (_, out) => { await out; });
  assert.deepEqual(facts(noCreds, 'Iran').acledData, old);

  const badLogin = store();
  const https = fakeHttps(acled([], { token: { status: 401, body: 'denied' } }));
  await run({ https, ddb: badLogin, env: CREDS }, { countries: ['Iran', 'Israel'] }, async (_, out) => {
    const r = JSON.parse((await out).body);
    assert.deepEqual(r.updated, ['Iran', 'Israel']);
  });
  assert.deepEqual(facts(badLogin, 'Iran').acledData, old);
  assert.deepEqual(facts(badLogin, 'Israel').acledData, old);
  assert.equal(https.calls.filter((c) => c.method === 'POST').length, 1, 'one login attempt for the whole run');

  const badRead = store();
  await run({ https: fakeHttps(acled([], { read: { status: 500, body: 'oops' } })), ddb: badRead, env: CREDS }, { countries: ['Iran'] }, async (_, out) => { await out; });
  assert.deepEqual(facts(badRead, 'Iran').acledData, old);
});

test('ACLED is only asked for the original 12; a country without ACLED never gets conflict data', async () => {
  const https = fakeHttps(acled([{ event_date: '2026-10-30', fatalities: '1', actor1: 'A' }]));
  const ddb = fakeDdb();
  await run({ https, ddb, env: CREDS }, { countries: ['Japan', 'Iran'] }, async (_, out) => { await out; });
  assert.equal('acledData' in facts(ddb, 'Japan'), false);
  assert.equal(https.calls.filter((c) => /\/api\/acled\/read/.test(c.path)).length, 1);
});

// ─── handler frame ──────────────────────────────────────────────────────────────

test('time budget: countries not started within FACTS_TIME_BUDGET_MS are reported as skipped and keep their previous record', async () => {
  const old = existing('Japan', { capital: { names: ['Tokyo'] } });
  const ddb = fakeDdb([old]);
  await run({ ddb, env: { FACTS_TIME_BUDGET_MS: '-1' } }, { countries: ['Japan', 'France'] }, async (_, out) => {
    const r = JSON.parse((await out).body);
    assert.deepEqual([r.updated, r.skipped], [[], ['France', 'Japan']]); // in the order of the target list
  });
  assert.equal(ddb.puts.length, 0);
  assert.deepEqual(facts(ddb, 'Japan'), old);
});

test('event.countries limits the run to those names; an unknown name updates nothing', async () => {
  const ddb = fakeDdb();
  await run({ ddb }, { countries: ['Japan', 'Atlantis'] }, async (_, out) => {
    const r = JSON.parse((await out).body);
    assert.deepEqual([r.updated, r.failed, r.skipped], [['Japan'], [], []]);
  });
  const none = fakeDdb();
  await run({ ddb: none }, { countries: ['Atlantis'] }, async (_, out) => assert.deepEqual(JSON.parse((await out).body).updated, []));
  assert.equal(none.puts.length, 0);
});

test('the handler answers 200 with the results as JSON; a missing table env var throws before any call', async () => {
  const ddb = fakeDdb();
  const https = fakeHttps();
  await run({ https, ddb, env: { SUMMARIZE_PREDICT_TABLE: undefined } }, { countries: ['Japan'] }, async (_, out) => {
    await assert.rejects(out, /Missing SUMMARIZE_PREDICT_TABLE env var/);
  });
  assert.equal(https.calls.length, 0);
  assert.equal(ddb.sent.length, 0);

  await run({ ddb: fakeDdb(), https: fakeHttps() }, { countries: ['Japan'] }, async (_, out) => {
    const res = await out;
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(JSON.parse(res.body)), ['updated', 'failed', 'skipped', 'leadershipChanges', 'noCapital', 'noPopulation']);
  });
});

test('the stored item carries a 90 day TTL, the PK/SK, countryName and lastUpdatedAt', async () => {
  const ddb = fakeDdb();
  await run({ ddb }, { countries: ['Japan'] }, async (_, out) => { await out; });
  const row = facts(ddb, 'Japan');
  assert.equal(row.PK, 'FACTS#Japan');
  assert.equal(row.countryName, 'Japan');
  assert.ok(Math.abs(row.ttl - (Date.now() / 1000 + 90 * 86400)) < 60);
  assert.ok(Date.parse(row.lastUpdatedAt) > Date.now() - 60000);
  assert.equal(ddb.puts[0].table, 'summary');
});

// ─── the record note (decision 0053) ────────────────────────────────────────────

test('NOTES_PREFIX unset writes no note; set, each stored facts item is also written as a country_facts note with no model', async () => {
  const quiet = fakeS3();
  await run({ ddb: fakeDdb(), s3: quiet }, { countries: ['Japan'] }, async (_, out) => { await out; });
  assert.equal(quiet.objs.size, 0);

  const s3 = fakeS3();
  await run({ ddb: fakeDdb(), s3, env: { NOTES_PREFIX: 'record/shadow/' } }, { countries: ['Japan'] }, async (_, out) => { await out; });
  const file = s3.keys('record/shadow/notes/country_facts/').find((k) => k.endsWith('.jsonl'));
  assert.ok(file, s3.keys().join());
  const [note] = s3.lines(file);
  assert.equal(note.subtype, 'country_facts');
  assert.deepEqual(note.iso3, ['JPN']);
  assert.equal(note.model, null);
  assert.equal(note.producer.lambda, 'newsCountryFactsUpdater');
  assert.deepEqual(note.payload.capital.source, 'wikidata');
});

test('a failed note write is logged [notes] and the DynamoDB record is still stored', async () => {
  const ddb = fakeDdb();
  const s3 = fakeS3({}, { fail: () => new Error('S3 down') });
  await run({ ddb, s3, env: { NOTES_PREFIX: 'record/' } }, { countries: ['Japan'] }, async ({ logs }, out) => {
    assert.deepEqual(JSON.parse((await out).body).updated, ['Japan']);
    assert.ok(logs.error.some((l) => l.startsWith('[notes] country_facts note not written: S3 down')), logs.error.join('\n'));
  });
  assert.ok(facts(ddb, 'Japan'));
});
