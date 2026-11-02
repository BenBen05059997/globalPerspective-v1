'use strict';
// newsWeeklyBrief: the prompt, what is done with the model's reply, and what is stored. The brief auto-publishes (status 'published'), so the key
// property pinned here is that an unusable reply never reaches the table. Offline: shared llm.chat is a fake (the real stripCodeFence stays),
// DynamoDB is an in-memory fake via shared/test/stubAws.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws } = require('../../../shared/test/stubAws');
const { stripCodeFence } = require('../../../shared/src/llm');

const INDEX = path.resolve(__dirname, '../src/index.js');
const NOW = new Date();
const TODAY = NOW.toISOString().slice(0, 10);
const YESTERDAY = new Date(NOW.getTime() - 86400000);
const YDAY = YESTERDAY.toISOString().slice(0, 10);
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const entry = (threadId, n, extra = {}) => ({
  topicId: `${threadId}-t${n}`, threadId, title: `${threadId} title ${n}`, category: 'conflict', regions: ['Iran'],
  archivedAt: NOW.toISOString(), sources: [{ title: 'Src', source: 'Outlet', url: `https://x.example/${threadId}/${n}` }], ...extra,
});

function makeStore() {
  const s = { today: [], earlier: {}, rows: {}, puts: [], putThrows: false };
  s.ddb = (input, cmd) => {
    if (cmd === 'GetCommand') {
      if (input.TableName === 'TopicsT') {
        if (input.Key.id === 'today-archive') return { Item: { entries: s.today } };
        const m = /^archive#(\d{4}-\d{2}-\d{2})$/.exec(input.Key.id);
        return { Item: m && s.earlier[m[1]] ? { entries: s.earlier[m[1]] } : undefined };
      }
      return { Item: s.rows[`${input.Key.PK}|${input.Key.SK}`] };
    }
    if (cmd === 'PutCommand') { if (s.putThrows) throw new Error('put denied'); s.puts.push(input); return {}; }
    throw new Error(`unexpected ${cmd}`);
  };
  // thr-A: 3 entries (2 today, 1 yesterday) in Iran, analysed at risk 80; thr-B: 1 entry, no analysis, Iran (country risk 60); thr-C: 1 entry, no analysis, no regions.
  s.today = [entry('thr-A', 1), entry('thr-A', 2), entry('thr-B', 1), entry('thr-C', 1, { regions: [] })];
  s.earlier[YDAY] = [entry('thr-A', 3, { archivedAt: iso(1) })];
  s.rows['THREAD#thr-A|THREAD_ANALYSIS'] = { threadTitle: 'The A thread', storyArc: 'A arc', trajectory: 'escalating', watchQuestions: ['q1', 'q2'], riskScore: 80 };
  s.rows['COUNTRY#Iran|COUNTRY_INTELLIGENCE'] = { riskScore: 60, riskLevel: 'elevated', generatedAt: iso(1) };
  return s;
}

const ENV = {
  TOPICS_DDB_TABLE: 'TopicsT', SUMMARIZE_PREDICT_TABLE: 'SummT', XAI_API_KEY: 'test-key', GROK_MODEL: 'test-model',
  MAX_TOKENS: undefined, TEMPERATURE: undefined, WEEKLY_TOP_THREADS: undefined, WEEKLY_TOP_COUNTRIES: undefined, NOTES_READS: undefined, NOTES_PREFIX: undefined,
};

const goodReply = (extra = {}) => ({
  signals: [
    { threadId: 'thr-A', kind: 'threat', lede: 'Strikes widen', fact: 'Reported strikes widened.', soWhat: 'Raises the odds of retaliation.' },
    { threadId: 'thr-B', kind: 'development', lede: 'Talks resume', fact: 'Parties met.', soWhat: '' },
    { threadId: 'thr-C', lede: 'Quiet shift', fact: 'Something changed.' },
  ],
  watch: [{ event: 'Vote', date: '2026-11-09', stake: 'Could shift the balance.' }],
  ...extra,
});

// `reply` is the model content as a string (or a function of the chat args); `chatExtra` adds fields to the chat result (e.g. model).
async function withHandler({ env = {}, fill = () => {}, reply, chatExtra = {} }, fn) {
  const store = makeStore();
  fill(store);
  const chats = [];
  const logs = [];
  const llm = { stripCodeFence, chat: async (a) => { chats.push(a); return { content: typeof reply === 'function' ? reply(a) : (typeof reply === 'string' ? reply : JSON.stringify(reply)), ...chatExtra }; } };
  const real = [console.log, console.warn, console.error];
  console.log = (...a) => logs.push(a.join(' ')); console.warn = () => {}; console.error = (...a) => logs.push(a.join(' '));
  const aws = stubAws({ ddb: store.ddb, modules: { './_shared/llm': llm } });
  try {
    const mod = aws.load(INDEX, { ...ENV, ...env });
    return await fn(mod, { store, chats, logs });
  } finally {
    aws.restore();
    [console.log, console.warn, console.error] = real;
  }
}
const noop = {};

// ── pure helpers ────────────────────────────────────────────────────────────

test('riskLevelFromScore: the four tiers at their boundaries, and null (no chip) for a score that is not a number', async () => {
  await withHandler({ reply: {} }, ({ riskLevelFromScore: f }) => {
    assert.deepEqual([0, 24.9, 25, 49.9, 50, 74.9, 75, 100].map(f), ['low', 'low', 'moderate', 'moderate', 'elevated', 'elevated', 'high', 'high']);
    assert.deepEqual([null, undefined, NaN, 'x'].map(f), [null, null, null, null]);
  });
});

test('groupByThread: biggest thread first, regions merged, sources de-duplicated by url (max 4, url required), latest title/date from the date order', async () => {
  await withHandler({ reply: {} }, ({ groupByThread }) => {
    const src = (u, s = 'o') => ({ title: `t-${u}`, url: `https://e/${u}`, source: s });
    const entries = [
      { threadId: 'small', date: '2026-11-02', title: 'S', regions: ['Peru'], category: 'x', sources: [] },
      { threadId: 'big', date: '2026-11-02', title: 'Newest', regions: ['Iran'], category: 'late', sources: [src(1), src(2), { title: 'no url' }, null] },
      { threadId: 'big', date: '2026-10-30', title: 'Oldest', regions: ['Iran', 'Iraq'], category: 'first', sources: [src(1), src(3), src(4), src(5), src(6)] },
    ];
    const out = groupByThread(entries);
    assert.deepEqual(out.map((g) => g.threadId), ['big', 'small']);
    const big = out[0];
    assert.equal(big.latestTitle, 'Newest');
    assert.equal(big.latestDate, '2026-11-02');
    assert.equal(big.category, 'first'); // the earliest entry's category
    assert.deepEqual(big.regions, ['Iran', 'Iraq']);
    assert.deepEqual(big.sources.map((s) => s.url), ['https://e/1', 'https://e/3', 'https://e/4', 'https://e/5']); // oldest entry first, deduped, capped at 4
  });
});

test('prompt: carries the week, one numbered block per signal with its exact threadId, the analysis fields that exist, and the strict-JSON instruction', async () => {
  await withHandler({ reply: {} }, ({ buildSignalsPrompt }) => {
    const ctx = [
      { threadId: 'thr-A', latestTitle: 'Latest A', latestDate: '2026-11-02', sources: [{ source: 'Reuters' }, { title: 'Only a title' }, {}], analysis: { threadTitle: 'The A thread', storyArc: 'A arc', trajectory: 'escalating', watchQuestions: ['q1', 'q2'] } },
      { threadId: 'thr-B', latestTitle: 'Latest B', latestDate: '2026-11-01', sources: [], analysis: null },
    ];
    const p = buildSignalsPrompt('2026-11-02', ctx);
    assert.match(p, /week ending 2026-11-02/);
    assert.match(p, /SIGNAL 1 \[threadId: thr-A\] — The A thread\n {2}Latest development: Latest A \(as of 2026-11-02\)\n {2}Story arc: A arc\n {2}Trajectory \(already assessed\): escalating\n {2}Watch questions: q1 \| q2\n {2}Covered by: Reuters, Only a title/);
    assert.match(p, /SIGNAL 2 \[threadId: thr-B\] — Latest B\n {2}Latest development: Latest B \(as of 2026-11-01\)(?!\n {2}Story arc)/); // no analysis: the latest title stands in, no arc lines
    assert.doesNotMatch(p.split('SIGNAL 2')[1], /Story arc|Trajectory|Watch questions|Covered by/);
    assert.match(p, /Return ONLY valid JSON, no code fences/);
    assert.match(p, /using its exact threadId/);
    assert.match(buildSignalsPrompt('w', []), /\(none\)/);
  });
});

test('parseJson: accepts a fence and trailing commas; anything else throws "Failed to parse JSON" with the start of the raw reply', async () => {
  await withHandler({ reply: {} }, ({ parseJson }) => {
    assert.deepEqual(parseJson('```json\n{"signals": [{"a": 1},],}\n```'), { signals: [{ a: 1 }] });
    assert.throws(() => parseJson('Sure! Here is the brief'), /^Error: Failed to parse JSON: [\s\S]*\nRaw: Sure! Here is the brief$/);
    assert.throws(() => parseJson(''), /Failed to parse JSON/);
    const long = 'x'.repeat(500);
    assert.throws(() => parseJson(long), (e) => e.message.endsWith(`Raw: ${'x'.repeat(200)}`));
  });
});

// ── handler: prompt sent to the model ───────────────────────────────────────

test('the model is asked once, with json mode, the configured model and limits, and a prompt built from the week\'s threads (biggest first, with analysis)', async () => {
  await withHandler({ reply: goodReply(), env: { WEEKLY_TOP_THREADS: '2' } }, async (mod, { chats }) => {
    await mod.handler({ weekKey: '2026-11-02' });
    assert.equal(chats.length, 1);
    assert.deepEqual([chats[0].step, chats[0].model, chats[0].maxTokens, chats[0].temperature, chats[0].json], ['weekly_brief', 'test-model', 3500, 0.3, true]);
    const p = chats[0].user;
    assert.match(p, /week ending 2026-11-02/);
    assert.match(p, /SIGNAL 1 \[threadId: thr-A\] — The A thread/);
    assert.match(p, /Latest development: thr-A title 2 \(as of /);
    assert.equal((p.match(/SIGNAL \d+ \[/g) || []).length, 2, 'WEEKLY_TOP_THREADS caps the signals asked for');
  });
});

test('mode "grounded" and the default "free" send the same prompt and store the same shape (current behaviour: the flag is only logged, see "Left for a decision")', async () => {
  const run = (event) => withHandler({ reply: goodReply() }, async (mod, { chats, store }) => { await mod.handler(event); return { prompt: chats[0].user, item: store.puts[0].Item }; });
  const free = await run({ weekKey: '2026-11-02' });
  const grounded = await run({ weekKey: '2026-11-02', mode: 'grounded' });
  assert.equal(grounded.prompt, free.prompt);
  assert.equal('mode' in grounded.item, false);
});

// ── handler: reply → stored row ─────────────────────────────────────────────

test('stored row: published WEEKLY_BRIEF#<week>, signals sorted by deterministic risk, with risk, region, iso3, as-of and sources from our data, not the model', async () => {
  const reply = goodReply();
  reply.signals[0].riskLevel = 'low'; reply.signals[0].riskScore = 1; reply.signals[0].sources = [{ url: 'https://invented' }]; reply.signals[0].iso3 = ['XXX'];
  await withHandler({ reply, chatExtra: { model: 'served-model-id' } }, async (mod, { store }) => {
    const before = Math.floor(Date.now() / 1000);
    const r = await mod.handler({ weekKey: '2026-11-02' });
    assert.deepEqual(r, { ok: true, weekKey: '2026-11-02', status: 'published', signals: 3, watch: 1 });
    assert.equal(store.puts.length, 1);
    assert.equal(store.puts[0].TableName, 'SummT');
    const item = store.puts[0].Item;
    assert.equal(item.PK, 'WEEKLY_BRIEF#2026-11-02');
    assert.equal(item.SK, 'WEEKLY_BRIEF');
    assert.equal(item.format, 'signals');
    assert.equal(item.weekOf, '2026-11-02');
    assert.equal(item.status, 'published');
    assert.equal(item.model, 'served-model-id');
    assert.deepEqual(item.threadIds, ['thr-A', 'thr-B', 'thr-C']);
    assert.ok(item.ttl >= before + 180 * 86400 - 2 && item.ttl <= before + 180 * 86400 + 5);
    assert.deepEqual(item.signals.map((s) => s.threadId), ['thr-A', 'thr-B', 'thr-C']); // risk 80, 60 (Iran), none
    const [a, b, c] = item.signals;
    assert.deepEqual([a.riskScore, a.riskLevel], [80, 'high']); // the thread's own analysis wins over the model's "1 / low"
    assert.deepEqual([b.riskScore, b.riskLevel], [60, 'elevated']); // no analysis: the max of its regions' country risk
    assert.deepEqual([c.riskScore, c.riskLevel], [null, null]); // nothing known: no chip, not 0
    assert.equal(a.region, 'Iran');
    assert.deepEqual(a.iso3, ['IRN']);
    assert.equal(a.asOf, TODAY);
    assert.equal(a.sources.length, 3);
    assert.ok(a.sources.every((s) => s.url.startsWith('https://x.example/')));
    assert.equal(a.lede, 'Strikes widen');
    assert.equal(a.soWhat, 'Raises the odds of retaliation.');
  });
});

test('model text is trimmed, kind defaults to threat unless exactly "development", missing soWhat/related become "" / null', async () => {
  const reply = goodReply();
  reply.signals[0] = { threadId: 'thr-A', kind: 'DEVELOPMENT', lede: '  Padded lede  ', fact: ' Fact. ', soWhat: ' So what. ', related: ' Linked ' };
  await withHandler({ reply }, async (mod, { store }) => {
    await mod.handler({ weekKey: 'w' });
    const byId = Object.fromEntries(store.puts[0].Item.signals.map((s) => [s.threadId, s]));
    assert.equal(byId['thr-A'].kind, 'threat'); // "DEVELOPMENT" is not the literal string, so it is shown as a threat
    assert.equal(byId['thr-A'].lede, 'Padded lede');
    assert.equal(byId['thr-A'].fact, 'Fact.');
    assert.equal(byId['thr-A'].soWhat, 'So what.');
    assert.equal(byId['thr-A'].related, 'Linked');
    assert.equal(byId['thr-B'].kind, 'development');
    assert.equal(byId['thr-C'].soWhat, '');
    assert.equal(byId['thr-C'].related, null);
    assert.equal(byId['thr-C'].kind, 'threat');
  });
});

test('signals the model got wrong are dropped, not repaired: no lede, no fact, an unknown threadId, a non-object', async () => {
  const reply = {
    signals: [
      { threadId: 'thr-A', lede: 'Ok', fact: 'Ok.' },
      { threadId: 'thr-B', lede: 'No fact' },
      { threadId: 'thr-C', fact: 'No lede.' },
      { threadId: 'thr-ZZZ', lede: 'Invented thread', fact: 'Nope.' },
      null, 'text', { lede: 'no thread id', fact: 'x' },
    ],
  };
  await withHandler({ reply }, async (mod, { store }) => {
    const r = await mod.handler({ weekKey: 'w' });
    assert.equal(r.signals, 1);
    assert.deepEqual(store.puts[0].Item.signals.map((s) => s.threadId), ['thr-A']);
    assert.deepEqual(store.puts[0].Item.threadIds, ['thr-A', 'thr-B', 'thr-C'], 'threadIds lists the threads asked about, not only the ones that produced a signal');
  });
});

test('watch: capped at 6, entries without an event dropped, fields trimmed, a missing date/stake becomes ""; a non-array watch is stored as []', async () => {
  const watch = [
    { event: ' First ', date: ' 2026-11-09 ', stake: ' why ' },
    { date: 'no event' }, null,
    { event: 'Second' },
    ...Array.from({ length: 6 }, (_, i) => ({ event: `Extra ${i}` })),
  ];
  await withHandler({ reply: goodReply({ watch }) }, async (mod, { store }) => {
    const r = await mod.handler({ weekKey: 'w' });
    const w = store.puts[0].Item.watch;
    assert.equal(w.length, 6);
    assert.equal(r.watch, 6);
    assert.deepEqual(w[0], { event: 'First', date: '2026-11-09', stake: 'why' });
    assert.deepEqual(w[1], { event: 'Second', date: '', stake: '' });
    assert.deepEqual(w.map((x) => x.event).slice(2), ['Extra 0', 'Extra 1', 'Extra 2', 'Extra 3']);
  });
  for (const bad of ['text', { event: 'x' }, null]) {
    await withHandler({ reply: goodReply({ watch: bad }) }, async (mod, { store }) => {
      await mod.handler({ weekKey: 'w' });
      assert.deepEqual(store.puts[0].Item.watch, []);
    });
  }
});

test('related signals come from the story web, not the model: relatedThreadIds are linked signals of the same week, and an empty `related` is filled from the first', async () => {
  await withHandler({
    reply: goodReply(),
    fill: (s) => { s.rows['WEB#INDEX|LATEST'] = { links: [{ from: 'thr-A', to: 'thr-B' }], shared: [{ a: 'thr-B', b: 'thr-C' }] }; },
  }, async (mod, { store }) => {
    await mod.handler({ weekKey: 'w' });
    const byId = Object.fromEntries(store.puts[0].Item.signals.map((s) => [s.threadId, s]));
    assert.deepEqual(byId['thr-A'].relatedThreadIds, ['thr-B']);
    assert.deepEqual(byId['thr-B'].relatedThreadIds.sort(), ['thr-A', 'thr-C']);
    assert.equal(byId['thr-A'].related, 'Talks resume');
  });
});

test('the model name stored falls back to the configured one when the model call does not report it', async () => {
  await withHandler({ reply: goodReply() }, async (mod, { store }) => {
    await mod.handler({ weekKey: 'w' });
    assert.equal(store.puts[0].Item.model, 'test-model');
  });
});

// ── handler: nothing unusable is published ──────────────────────────────────

const REPLIES = [
  ['text instead of JSON', 'Here is the weekly brief you asked for.', /Failed to parse JSON/],
  ['an empty reply', '', /Failed to parse JSON/],
  ['truncated JSON', '{"signals": [{"threadId": "thr-A", "lede": "x", "fa', /Failed to parse JSON/],
  ['an empty object', '{}', /No usable signals/],
  ['an empty signals list', '{"signals": [], "watch": []}', /No usable signals/],
  ['signals that all lack text', JSON.stringify({ signals: [{ threadId: 'thr-A' }, { threadId: 'thr-B', lede: 'only lede' }] }), /No usable signals/],
  ['a signals list for threads that were not asked about', JSON.stringify({ signals: [{ threadId: 'other', lede: 'l', fact: 'f' }] }), /No usable signals/],
];
for (const [name, reply, message] of REPLIES) {
  test(`${name}: the run fails with a failed-run marker and nothing is written`, async () => {
    await withHandler({ reply }, async (mod, { store, logs }) => {
      await assert.rejects(mod.handler({ weekKey: 'w' }), message);
      assert.equal(store.puts.length, 0);
      assert.ok(logs.some((l) => l.startsWith('[pipeline-status] ') && l.includes('"reason":"weekly-brief-failed"')));
    });
  });
}

test('a reply of JSON null throws rather than publishing (the error is a TypeError, not a friendly message)', async () => {
  await withHandler({ reply: 'null' }, async (mod, { store }) => {
    await assert.rejects(mod.handler({ weekKey: 'w' }), TypeError);
    assert.equal(store.puts.length, 0);
  });
});

test('a fenced reply with trailing commas is accepted', async () => {
  const raw = '```json\n{"signals": [{"threadId": "thr-A", "lede": "L", "fact": "F",},], "watch": [],}\n```';
  await withHandler({ reply: raw }, async (mod, { store }) => {
    assert.equal((await mod.handler({ weekKey: 'w' })).signals, 1);
    assert.equal(store.puts[0].Item.signals[0].lede, 'L');
  });
});

test('a model call that throws fails the run and writes nothing', async () => {
  await withHandler({ reply: () => { throw new Error('upstream 503'); } }, async (mod, { store }) => {
    await assert.rejects(mod.handler({ weekKey: 'w' }), /upstream 503/);
    assert.equal(store.puts.length, 0);
  });
});

test('configuration gaps fail before any model call: no tables, no LLM key', async () => {
  await withHandler({ reply: goodReply(), env: { XAI_API_KEY: undefined } }, async (mod, { chats }) => {
    await assert.rejects(mod.handler({}), /Missing LLM key/);
    assert.equal(chats.length, 0);
  });
  await withHandler({ reply: goodReply(), env: { SUMMARIZE_PREDICT_TABLE: undefined } }, async (mod, { chats }) => {
    await assert.rejects(mod.handler({}), /Missing table config/);
    assert.equal(chats.length, 0);
  });
});

test('an empty archive week is a normal skip: no model call, nothing stored', async () => {
  await withHandler({ reply: goodReply(), fill: (s) => { s.today = []; s.earlier = {}; } }, async (mod, { store, chats }) => {
    assert.deepEqual(await mod.handler({ weekKey: 'w' }), { ok: true, skipped: 'no-archive-entries', weekKey: 'w' });
    assert.equal(chats.length + store.puts.length, 0);
  });
});
