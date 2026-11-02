'use strict';
// newsEmailSender: the `drift_alert` mode end to end, and what each mode does when Resend rejects a send.
// Offline: the AWS SDK is replaced by shared/test/stubAws (an in-memory table fake answers the scans) and global fetch is a fake Resend. A real send is
// only ever "enabled" (EMAIL_SEND_DRY_RUN=false) against that fake fetch, so nothing leaves the process.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws } = require('../../../shared/test/stubAws');

const INDEX = path.resolve(__dirname, '../src/index.js');
const NOW = Date.now();
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();

const drift = (country, asOf, extra = {}) => ({
  PK: `COUNTRY#${country}`, SK: `DRIFT#${asOf}`, countryName: country, asOf, generatedAt: hoursAgo(2),
  changeLevel: { from: 'moderate', to: 'elevated' }, whyChanged: `Reason for ${country} ${asOf}`, ...extra,
});

// The tables the Lambda scans, filtered the way the real FilterExpressions filter (only the parts the code depends on).
function makeStore() {
  const store = {
    notes: [], prefs: [], alerts: [], briefs: [], markers: new Map(), updates: [], puts: [],
  };
  store.ddb = (input, cmd) => {
    if (cmd === 'ScanCommand') {
      const v = input.ExpressionAttributeValues || {};
      if (input.TableName === 'SummarizeAndPredict' && v[':dsk']) {
        return { Items: store.notes.filter((n) => !n.emailedAt && n.generatedAt >= v[':cut'] && n.PK.startsWith('COUNTRY#') && n.SK.startsWith('DRIFT#')) };
      }
      if (input.TableName === 'SummarizeAndPredict' && v[':sk'] === 'WEEKLY_BRIEF') return { Items: store.briefs };
      if (input.TableName === 'GlobalPerspectiveUserPrefs') {
        const opt = (input.ExpressionAttributeNames || {})['#opt'];
        if (opt) return { Items: store.prefs.filter((p) => p[opt] === true && p.email) };
        return { Items: store.prefs.filter((p) => p.driftOptIn === true && p.email && p.followedCountries) };
      }
      if (input.TableName === 'GlobalPerspectiveBreakingAlerts') {
        return { Items: store.alerts.filter((a) => a.status === 'confirmed' && !a.emailedAt && a.alertedAt >= v[':cut']) };
      }
    }
    if (cmd === 'GetCommand') return { Item: store.markers.get(input.Key.PK) };
    if (cmd === 'PutCommand') { store.puts.push(input.Item); store.markers.set(input.Item.PK, input.Item); return {}; }
    if (cmd === 'UpdateCommand') { store.updates.push({ table: input.TableName, key: input.Key, values: input.ExpressionAttributeValues }); return {}; }
    throw new Error(`unexpected ${cmd} on ${input.TableName}`);
  };
  return store;
}

// A fake Resend. `fail(to)` decides which addresses get a 500.
function fakeResend(fail = () => false) {
  const calls = [];
  const fn = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url, auth: opts.headers.Authorization, ...body });
    if (fail(body.to[0])) return { ok: false, status: 500, text: async () => '{"message":"boom"}' };
    return { ok: true, status: 200, text: async () => '{"id":"fake"}' };
  };
  return { fn, calls };
}

const ENV = {
  USER_PREFS_TABLE: 'GlobalPerspectiveUserPrefs', SUMMARIZE_PREDICT_TABLE: 'SummarizeAndPredict', BREAKING_ALERTS_TABLE: 'GlobalPerspectiveBreakingAlerts',
  UNSUB_BASE_URL: 'https://unsub.example/fn', EMAIL_FROM: 'brief@example.test', SITE_URL: 'https://site.example',
  RESEND_API_KEY: 'test-key', TEST_RECIPIENT: undefined, EMAIL_SEND_DRY_RUN: 'false', RECORD_READS: undefined,
  DRIFT_FRESH_HOURS: undefined, BREAKING_FRESH_HOURS: undefined,
};

// Run `fn(handler, ctx)` with a loaded Lambda, a fake store and a fake Resend; everything global is restored afterwards.
async function withSender(env, setup, fn) {
  const store = makeStore();
  const resend = fakeResend(setup.fail);
  setup.fill(store);
  const realFetch = globalThis.fetch;
  const realLog = [console.log, console.error, console.warn];
  globalThis.fetch = resend.fn;
  console.log = () => {}; console.error = () => {}; console.warn = () => {};
  const aws = stubAws({ ddb: store.ddb });
  try {
    const mod = aws.load(INDEX, { ...ENV, ...env });
    return await fn(mod.handler, { store, resend });
  } finally {
    aws.restore();
    globalThis.fetch = realFetch;
    [console.log, console.error, console.warn] = realLog;
  }
}

const fillDrift = (store) => {
  store.notes = [
    drift('France', '2026-11-01'),
    drift('France', '2026-10-31'),
    drift('Japan', '2026-11-01'),
    drift('Chad', '2026-11-01', { emailedAt: hoursAgo(1) }), // already emailed
    drift('Peru', '2026-10-01', { generatedAt: hoursAgo(100) }), // older than DRIFT_FRESH_HOURS (36)
  ];
  store.prefs = [
    { uid: 'u1', email: 'one@example.test', driftOptIn: true, unsubToken: 't1', followedCountries: new Set(['France']) },
    { uid: 'u2', email: 'two@example.test', driftOptIn: true, unsubToken: 't2', followedCountries: new Set(['Japan', 'France', 'Chad']) },
    { uid: 'u3', email: 'three@example.test', driftOptIn: true, unsubToken: 't3', followedCountries: new Set(['Germany']) }, // follows none of the changed countries
    { uid: 'u4', email: 'four@example.test', driftOptIn: false, unsubToken: 't4', followedCountries: new Set(['France']) }, // not opted in
    { uid: 'u5', email: 'five@example.test', driftOptIn: true, unsubToken: 't5' }, // no follow list
    { uid: 'u6', driftOptIn: true, unsubToken: 't6', followedCountries: new Set(['France']) }, // no email
  ];
};

// ── drift_alert ─────────────────────────────────────────────────────────────

test('drift_alert real send: each country is emailed to its followers only, with the renderer subject and a drift unsubscribe link', async () => {
  await withSender({}, { fill: fillDrift }, async (handler, { resend }) => {
    const r = await handler({ mode: 'drift_alert' });
    assert.equal(r.ok, true);
    assert.equal(r.mode, 'drift_alert');
    assert.equal(r.dryRun, false);
    assert.equal(r.countries, 2); // France + Japan; Chad (already emailed) and Peru (stale) are not loaded
    assert.equal(r.subscribers, 3); // u1, u2, u3: opted in, with an email and a follow list
    assert.equal(r.sent, 3); // France -> u1 + u2, Japan -> u2
    const to = resend.calls.map((c) => `${c.to[0]}|${c.subject}`).sort();
    assert.deepEqual(to, [
      'one@example.test|France: 2 updates to our read',
      'two@example.test|France: 2 updates to our read',
      'two@example.test|Japan: our read changed — moderate → elevated',
    ]);
    assert.ok(!resend.calls.some((c) => c.to[0] === 'three@example.test' || c.to[0] === 'four@example.test' || c.to[0] === 'five@example.test'));
    const franceOne = resend.calls.find((c) => c.to[0] === 'one@example.test');
    assert.equal(franceOne.url, 'https://api.resend.com/emails');
    assert.equal(franceOne.auth, 'Bearer test-key');
    assert.equal(franceOne.from, 'brief@example.test');
    assert.match(franceOne.text, /Reason for France 2026-11-01/);
    assert.match(franceOne.text, /Reason for France 2026-10-31/);
    assert.doesNotMatch(franceOne.text, /Japan/);
    const link = 'https://unsub.example/fn?action=unsubscribe&uid=u1&token=t1&kind=drift';
    assert.match(franceOne.text, new RegExp(link.replace(/[?.]/g, '\\$&')));
    assert.equal(franceOne.headers['List-Unsubscribe'], `<${link}>`);
    assert.equal(franceOne.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.deepEqual(r.perCountry.map((c) => [c.country, c.notes, c.followers, c.sent]).sort(), [['France', 2, 2, 2], ['Japan', 1, 1, 1]]);
  });
});

test('drift_alert real send: every note of a sent country is stamped emailedAt with the sent count, others are left alone', async () => {
  await withSender({}, { fill: fillDrift }, async (handler, { store }) => {
    await handler({ mode: 'drift_alert' });
    const stamped = store.updates.map((u) => `${u.key.PK}|${u.key.SK}|${u.values[':n']}`).sort();
    assert.deepEqual(stamped, [
      'COUNTRY#France|DRIFT#2026-10-31|2',
      'COUNTRY#France|DRIFT#2026-11-01|2',
      'COUNTRY#Japan|DRIFT#2026-11-01|1',
    ]);
    assert.ok(store.updates.every((u) => u.table === 'SummarizeAndPredict' && typeof u.values[':t'] === 'string'));
    // the second run finds nothing left to send (the stamp is what makes it idempotent)
    for (const u of store.updates) store.notes.find((n) => n.PK === u.key.PK && n.SK === u.key.SK).emailedAt = u.values[':t'];
    const again = await handler({ mode: 'drift_alert' });
    assert.deepEqual([again.countries, again.sent], [0, 0]);
  });
});

test('drift_alert dry run: counts the would-be sends but sends nothing and stamps nothing', async () => {
  await withSender({ EMAIL_SEND_DRY_RUN: undefined }, { fill: fillDrift }, async (handler, { store, resend }) => {
    const r = await handler({ mode: 'drift_alert' });
    assert.equal(r.dryRun, true);
    assert.equal(r.sent, 3);
    assert.equal(resend.calls.length, 0);
    assert.equal(store.updates.length, 0);
  });
});

test('drift_alert: a country nobody follows is reported with 0 followers and is neither emailed nor stamped', async () => {
  await withSender({}, {
    fill: (s) => { fillDrift(s); s.prefs = s.prefs.filter((p) => p.uid === 'u1'); }, // only a France follower
  }, async (handler, { store, resend }) => {
    const r = await handler({ mode: 'drift_alert' });
    assert.deepEqual(r.perCountry.find((c) => c.country === 'Japan'), { country: 'Japan', notes: 1, followers: 0, sent: 0 });
    assert.deepEqual(resend.calls.map((c) => c.to[0]), ['one@example.test']);
    assert.ok(store.updates.every((u) => u.key.PK === 'COUNTRY#France'), 'Japan is left unstamped so a later follower still gets it');
  });
});

test('drift_alert: no fresh notes returns an empty result without reading subscribers or sending', async () => {
  await withSender({}, { fill: (s) => { s.notes = []; } }, async (handler, { resend }) => {
    assert.deepEqual(await handler({ mode: 'drift_alert' }), { ok: true, mode: 'drift_alert', countries: 0, sent: 0 });
    assert.equal(resend.calls.length, 0);
  });
});

test('drift_alert: a note without countryName is grouped by its COUNTRY# partition key', async () => {
  await withSender({}, {
    fill: (s) => {
      s.notes = [{ ...drift('France', '2026-11-01'), countryName: undefined }];
      s.prefs = [{ uid: 'u1', email: 'one@example.test', driftOptIn: true, unsubToken: 't1', followedCountries: new Set(['France']) }];
    },
  }, async (handler, { resend }) => {
    const r = await handler({ mode: 'drift_alert' });
    assert.equal(r.sent, 1);
    assert.match(resend.calls[0].subject, /^France: /);
  });
});

test('drift_alert: followedCountries that arrive as a plain array still match', async () => {
  await withSender({}, {
    fill: (s) => {
      fillDrift(s);
      s.prefs = [{ uid: 'u1', email: 'one@example.test', driftOptIn: true, unsubToken: 't1', followedCountries: ['Japan'] }];
    },
  }, async (handler, { resend }) => {
    await handler({ mode: 'drift_alert' });
    assert.deepEqual(resend.calls.map((c) => c.subject), ['Japan: our read changed — moderate → elevated']);
  });
});

test('drift_alert with TEST_RECIPIENT: one address gets one email per country (no unsubscribe header), real followers get nothing', async () => {
  await withSender({ TEST_RECIPIENT: 'me@example.test' }, { fill: fillDrift }, async (handler, { resend }) => {
    const r = await handler({ mode: 'drift_alert' });
    assert.equal(r.sent, 2);
    assert.deepEqual(resend.calls.map((c) => c.to[0]), ['me@example.test', 'me@example.test']);
    assert.ok(resend.calls.every((c) => c.headers === undefined && !/unsubscribe/i.test(c.text)));
  });
});

test('drift_alert: a send to one follower failing is reported per recipient, the others still get theirs', async () => {
  await withSender({}, { fill: fillDrift, fail: (to) => to === 'one@example.test' }, async (handler, { resend }) => {
    const r = await handler({ mode: 'drift_alert' });
    assert.equal(r.ok, true);
    assert.equal(r.sent, 2); // France -> u2, Japan -> u2
    const france = r.perCountry.find((c) => c.country === 'France');
    assert.equal(france.sent, 1);
    assert.equal(france.errors.length, 1);
    assert.equal(france.errors[0].email, 'one@example.test');
    assert.match(france.errors[0].error, /Resend send failed \(500\)/);
    assert.equal(resend.calls.length, 3);
  });
});

test('drift_alert: when every send to a country fails its notes are not stamped, so the next run retries them', async () => {
  await withSender({}, { fill: fillDrift, fail: () => true }, async (handler, { store }) => {
    const r = await handler({ mode: 'drift_alert' });
    assert.equal(r.sent, 0);
    assert.equal(store.updates.length, 0);
  });
});

test('drift_alert: when only some followers got the email the notes are still stamped (current behaviour, see "Left for a decision")', async () => {
  await withSender({}, { fill: fillDrift, fail: (to) => to === 'one@example.test' }, async (handler, { store }) => {
    await handler({ mode: 'drift_alert' });
    const france = store.updates.filter((u) => u.key.PK === 'COUNTRY#France');
    assert.equal(france.length, 2);
    assert.ok(france.every((u) => u.values[':n'] === 1)); // stamped with the one send that succeeded; follower one is never retried
  });
});

test('drift_alert with TEST_RECIPIENT and a real send stamps the notes emailed (current behaviour: a smoke test consumes the notes for real followers)', async () => {
  await withSender({ TEST_RECIPIENT: 'me@example.test' }, { fill: fillDrift }, async (handler, { store }) => {
    await handler({ mode: 'drift_alert' });
    assert.equal(store.updates.length, 3);
  });
});

test('an unknown mode is refused without touching the tables or Resend', async () => {
  await withSender({}, { fill: fillDrift }, async (handler, { store, resend }) => {
    assert.deepEqual(await handler({ mode: 'nope' }), { ok: false, error: 'unknown mode: nope' });
    assert.equal(resend.calls.length + store.updates.length + store.puts.length, 0);
  });
});

test('a table failure comes back as { ok: false, error } rather than throwing', async () => {
  const aws = stubAws({ ddb: () => { throw new Error('ddb down'); } });
  const quiet = console.error; console.error = () => {};
  try {
    const mod = aws.load(INDEX, ENV);
    assert.deepEqual(await mod.handler({ mode: 'drift_alert' }), { ok: false, mode: 'drift_alert', error: 'ddb down' });
  } finally { console.error = quiet; aws.restore(); }
});

// ── send failure handling in deliver(): weekly and breaking markers ─────────

const weeklyBrief = {
  PK: 'WEEKLY#2026-11-01', SK: 'WEEKLY_BRIEF', status: 'published', weekOf: '2026-11-01',
  signals: [{ kind: 'development', lede: 'Talks resume', fact: 'Parties met.', soWhat: 'De-escalation.' }], watch: [],
};
const subs = (n) => Array.from({ length: n }, (_, i) => ({ uid: `u${i}`, email: `r${i}@example.test`, digestOptIn: true, breakingOptIn: true, unsubToken: `t${i}` }));
const confirmedAlert = (key) => ({ alertKey: key, status: 'confirmed', alertedAt: hoursAgo(1), draft: { subject: `Breaking ${key}`, text: 'body', html: '<body>x</body>' } });

test('weekly: with some sends failing, the failures are listed and the week marker records only the successful count', async () => {
  await withSender({}, {
    fill: (s) => { s.briefs = [weeklyBrief]; s.prefs = subs(3); },
    fail: (to) => to === 'r1@example.test',
  }, async (handler, { store, resend }) => {
    const r = await handler({ mode: 'weekly' });
    assert.equal(r.recipients, 3);
    assert.equal(r.sent, 2);
    assert.deepEqual(r.errors.map((e) => e.email), ['r1@example.test']);
    assert.equal(resend.calls.length, 3);
    assert.equal(store.puts.length, 1);
    assert.equal(store.puts[0].PK, 'EMAILLOG#weekly#2026-11-01');
    assert.equal(store.puts[0].recipients, 2);
    assert.equal(typeof store.puts[0].ttl, 'number');
    // current behaviour: the marker makes the next run report already_sent, so the failed recipient is not retried (see "Left for a decision")
    assert.equal((await handler({ mode: 'weekly' })).reason, 'already_sent');
  });
});

test('weekly: when every send fails no marker is written, so the next run tries again', async () => {
  await withSender({}, {
    fill: (s) => { s.briefs = [weeklyBrief]; s.prefs = subs(2); },
    fail: () => true,
  }, async (handler, { store }) => {
    const r = await handler({ mode: 'weekly' });
    assert.equal(r.sent, 0);
    assert.equal(r.errors.length, 2);
    assert.equal(store.puts.length, 0);
  });
});

test('weekly: a missing RESEND_API_KEY fails every recipient with a clear error and writes no marker', async () => {
  await withSender({ RESEND_API_KEY: undefined }, {
    fill: (s) => { s.briefs = [weeklyBrief]; s.prefs = subs(1); },
  }, async (handler, { store, resend }) => {
    const r = await handler({ mode: 'weekly' });
    assert.equal(r.sent, 0);
    assert.equal(r.errors[0].error, 'RESEND_API_KEY missing');
    assert.equal(resend.calls.length, 0);
    assert.equal(store.puts.length, 0);
  });
});

test('breaking: a partial failure stamps the alert emailed with the successful count and lists the failed address', async () => {
  await withSender({}, {
    fill: (s) => { s.alerts = [confirmedAlert('a1')]; s.prefs = subs(3); },
    fail: (to) => to === 'r2@example.test',
  }, async (handler, { store }) => {
    const r = await handler({ mode: 'breaking' });
    assert.equal(r.sent, 2);
    assert.deepEqual(r.perAlert[0].errors.map((e) => e.email), ['r2@example.test']);
    assert.equal(store.updates.length, 1);
    assert.equal(store.updates[0].table, 'GlobalPerspectiveBreakingAlerts');
    assert.deepEqual(store.updates[0].key, { alertKey: 'a1' });
    assert.equal(store.updates[0].values[':n'], 2);
  });
});

test('breaking: when every send fails the failures are reported per recipient', async () => {
  await withSender({}, {
    fill: (s) => { s.alerts = [confirmedAlert('a1')]; s.prefs = subs(2); },
    fail: () => true,
  }, async (handler) => {
    const r = await handler({ mode: 'breaking' });
    assert.equal(r.sent, 0);
    assert.equal(r.perAlert[0].errors.length, 2);
  });
});

test('breaking: when every send fails the alert is NOT marked emailed, so the next run retries it', async () => {
  await withSender({}, {
    fill: (s) => { s.alerts = [confirmedAlert('a1')]; s.prefs = subs(2); },
    fail: () => true,
  }, async (handler, { store }) => {
    await handler({ mode: 'breaking' });
    assert.equal(store.updates.length, 0); // no emailedAt / emailedCount write
  });
});

test('breaking: with no opted-in recipients the alert is not stamped, so a later subscriber can still get it', async () => {
  await withSender({}, { fill: (s) => { s.alerts = [confirmedAlert('a1')]; s.prefs = []; } }, async (handler, { store }) => {
    const r = await handler({ mode: 'breaking' });
    assert.equal(r.sent, 0);
    assert.equal(store.updates.length, 0);
  });
});

test('breaking: an alert without a draft is skipped and never stamped', async () => {
  await withSender({}, {
    fill: (s) => { s.alerts = [{ ...confirmedAlert('nodraft'), draft: undefined }, confirmedAlert('ok')]; s.prefs = subs(1); },
  }, async (handler, { store }) => {
    const r = await handler({ mode: 'breaking' });
    assert.deepEqual(r.perAlert.map((a) => a.alertKey), ['ok']);
    assert.deepEqual(store.updates.map((u) => u.key.alertKey), ['ok']);
  });
});

// ── sendEmail (the Resend seam) ─────────────────────────────────────────────

test('sendEmail: a non-2xx Resend answer throws with the status and body; missing fields throw before any request', async () => {
  const { sendEmail } = require('../src/sendEmail');
  const realFetch = globalThis.fetch;
  const resend = fakeResend(() => true);
  globalThis.fetch = resend.fn;
  try {
    await assert.rejects(sendEmail({ apiKey: 'k', from: 'a@x.test', to: 'b@x.test', subject: 's', text: 't' }), /Resend send failed \(500\): \{"message":"boom"\}/);
    await assert.rejects(sendEmail({ apiKey: 'k', from: 'a@x.test', to: '', subject: 's' }), /to address missing/);
    await assert.rejects(sendEmail({ apiKey: 'k', from: 'a@x.test', to: 'b@x.test', subject: '' }), /subject missing/);
    await assert.rejects(sendEmail({ apiKey: 'k', from: '', to: 'b@x.test', subject: 's' }), /from address missing/);
    assert.equal(resend.calls.length, 1);
  } finally { globalThis.fetch = realFetch; }
});
