'use strict';
// newsPostDevTo daily brief: the prompt the model gets, what is done with its reply, the DAILY_BRIEF#<date> row that is stored, and the handler's skip paths.
// Offline: the shared llm.chat is replaced with a fake (stripCodeFence stays the real one), DynamoDB is an in-memory fake via shared/test/stubAws.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws } = require('../../../shared/test/stubAws');
const { stripCodeFence } = require('../../../shared/src/llm');

const INDEX = path.resolve(__dirname, '../src/index.js');
const DAY = 86400000;
const TODAY = new Date().toISOString().slice(0, 10);

const entry = (n, extra = {}) => ({
  id: `e${n}`, title: `Headline number ${n} about the world`, category: 'conflict', regions: ['Iran'], threadId: `thr-${n}`,
  archivedAt: new Date().toISOString(), sources: [{ source: `Outlet A${n}`, title: 't' }, { source: 'Outlet Shared', title: 't' }],
  ai: { summary: 'S'.repeat(300) }, ...extra,
});
const brief = (extra = {}) => ({
  headline: 'Talks collapse as the region braces',
  summary: 'A **flowing** overview paragraph.',
  topStories: [{ title: 'Headline number 1 about the world', category: 'conflict', regions: ['Iran'], prediction: 'p', sourceCount: 2, threadId: 'model-invented' }],
  risingThread: { threadId: 'model-invented', title: 'The Iran thread', articleCount: 4, dayCount: 3, trajectory: 'escalating', oneLiner: 'why' },
  countryToWatch: { countryName: 'Iran', riskLevel: 'high', headline: 'h', trajectory: 'escalating' },
  categoryBreakdown: { conflict: 2 },
  ...extra,
});

function makeStore() {
  const s = { entries: [entry(1), entry(2)], rows: {}, puts: [] };
  s.ddb = (input, cmd) => {
    if (cmd === 'GetCommand') {
      if (input.TableName === 'TopicsT') return { Item: input.Key.id === 'today-archive' ? { id: 'today-archive', entries: s.entries } : undefined };
      return { Item: s.rows[`${input.Key.PK}|${input.Key.SK}`] };
    }
    if (cmd === 'PutCommand') { if (s.putThrows) throw new Error('put denied'); s.puts.push(input); return {}; }
    throw new Error(`unexpected ${cmd}`);
  };
  return s;
}

const ENV = {
  TOPICS_DDB_TABLE: 'TopicsT', SUMMARIZE_PREDICT_TABLE: 'SummT', XAI_API_KEY: 'test-key', GROK_MODEL: 'test-model',
  RECORD_READS: undefined, NOTES_READS: undefined, NOTES_PREFIX: undefined,
};

// `reply` is the model's content (string) or a function (args) -> content; a thrown error from it is the model failing.
async function withHandler(env, fill, reply, fn) {
  const store = makeStore();
  fill(store);
  const chats = [];
  const llm = { stripCodeFence, chat: async (args) => { chats.push(args); const c = typeof reply === 'function' ? reply(args) : reply; return { content: c }; } };
  const real = [console.log, console.warn, console.error];
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  const aws = stubAws({ ddb: store.ddb, modules: { './_shared/llm': llm } });
  try {
    const mod = aws.load(INDEX, { ...ENV, ...env });
    return await fn(mod, { store, chats });
  } finally {
    aws.restore();
    [console.log, console.warn, console.error] = real;
  }
}
const body = (r) => JSON.parse(r.body);

// ── buildBriefPrompt ────────────────────────────────────────────────────────

test('prompt: numbered headlines carry category label, regions, source count and a 120-char summary snippet', async () => {
  await withHandler({}, () => {}, '{}', ({ buildBriefPrompt }) => {
    const p = buildBriefPrompt([entry(1), entry(2, { regions: [], category: 'unknown-cat' })], {}, {}, 'November 2, 2026', '2026-11-02');
    assert.match(p, /Today is November 2, 2026 \(2026-11-02\)/);
    assert.match(p, /=== TODAY'S HEADLINES \(2 stories\) ===/);
    assert.match(p, new RegExp(`1\\. \\[[^\\]]+\\] Headline number 1 about the world \\(Iran, 2 sources\\) \\| S{120}\\n`));
    assert.match(p, /2\. \[General\] Headline number 2 about the world \(Global, 2 sources\)/); // unknown category -> General, no regions -> Global
    assert.doesNotMatch(p, /S{121}/);
    assert.match(p, /Return ONLY valid JSON/);
    for (const field of ['"headline"', '"summary"', '"topStories"', '"risingThread"', '"countryToWatch"', '"categoryBreakdown"']) assert.ok(p.includes(field), field);
  });
});

test('prompt: only the first 20 titled entries are listed, an untitled entry is dropped, and only 3 regions per line', async () => {
  await withHandler({}, () => {}, '{}', ({ buildBriefPrompt }) => {
    const entries = [entry(0, { title: '', regions: ['A', 'B', 'C', 'D'] }), ...Array.from({ length: 25 }, (_, i) => entry(i + 1))];
    const p = buildBriefPrompt(entries, {}, {}, 'd', 'k');
    const lines = p.split('\n').filter((l) => /^\d+\. \[/.test(l));
    assert.equal(lines.length, 20);
    assert.ok(!p.includes('Headline number 21 about'));
    assert.match(p, /\(26 stories\)/); // the header counts all entries, the list is capped
  });
  await withHandler({}, () => {}, '{}', ({ buildBriefPrompt }) => {
    const p = buildBriefPrompt([entry(1, { regions: ['A', 'B', 'C', 'D'] })], {}, {}, 'd', 'k');
    assert.match(p, /\(A, B, C, 2 sources\)/);
  });
});

test('prompt: thread arcs and country intelligence are included, risk-ordered and capped, or say there are none', async () => {
  await withHandler({}, () => {}, '{}', ({ buildBriefPrompt }) => {
    const threads = { 'thr-1': { threadTitle: 'The Iran thread', entryCount: 4, storyArc: 'x'.repeat(250) } };
    const countries = {
      Chile: { riskLevel: 'low', headline: 'calm' }, Iran: { riskLevel: 'high', headline: 'strikes' }, Peru: { riskLevel: 'elevated', bluf: 'protests' },
      Cuba: { riskLevel: 'moderate' }, Chad: { riskLevel: 'moderate', headline: 'c' }, Laos: { riskLevel: 'low', headline: 'l' },
    };
    const p = buildBriefPrompt([entry(1)], threads, countries, 'd', 'k');
    assert.match(p, /- threadId=thr-1 "The Iran thread" \[4 articles\]: x{200}\n/);
    assert.doesNotMatch(p, /x{201}/);
    const block = p.split('=== COUNTRY INTELLIGENCE ===\n')[1].split('\n\n')[0].split('\n');
    assert.equal(block.length, 5);
    assert.equal(block[0], '- Iran [HIGH]: strikes');
    assert.equal(block[1], '- Peru [ELEVATED]: protests'); // falls back to bluf
    assert.ok(block.some((l) => l === '- Cuba [MODERATE]: No headline'));
    assert.ok(!block.some((l) => l.includes('Laos')), 'the lowest-risk country falls off the cap of 5');
    const none = buildBriefPrompt([entry(1)], {}, {}, 'd', 'k');
    assert.match(none, /No thread analyses available today\./);
    assert.match(none, /No country intelligence available today\./);
  });
});

// ── model reply → stored row ────────────────────────────────────────────────

test('the stored row: DAILY_BRIEF#<date> keys, the model text, the real model name, stats from the entries and a 90-day ttl', async () => {
  await withHandler({}, () => {}, JSON.stringify(brief()), async (mod, { store, chats }) => {
    const before = Math.floor(Date.now() / 1000);
    const r = await mod.handler({});
    assert.equal(r.statusCode, 200);
    assert.deepEqual(body(r), { status: 'ok', dateKey: TODAY, dailyBrief: { headline: 'Talks collapse as the region braces', stored: true } });
    assert.equal(store.puts.length, 1);
    assert.equal(store.puts[0].TableName, 'SummT');
    const item = store.puts[0].Item;
    assert.equal(item.PK, `DAILY_BRIEF#${TODAY}`);
    assert.equal(item.SK, 'DAILY_BRIEF');
    assert.equal(item.dateKey, TODAY);
    assert.match(item.displayDate, /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
    assert.equal(item.headline, 'Talks collapse as the region braces');
    assert.equal(item.summary, 'A **flowing** overview paragraph.');
    assert.deepEqual(item.categoryBreakdown, { conflict: 2 });
    assert.deepEqual(item.stats, { totalArticles: 2, sourceOutlets: 3, countriesCovered: 1 }); // outlets: A1, A2, Shared
    assert.equal(item.model, 'test-model');
    assert.ok(Date.parse(item.generatedAt) <= Date.now());
    assert.ok(item.ttl >= before + 90 * 86400 - 2 && item.ttl <= before + 90 * 86400 + 5);
    assert.equal(chats.length, 1);
    assert.equal(chats[0].step, 'daily_brief');
    assert.equal(chats[0].model, 'test-model');
    assert.equal(chats[0].maxTokens, 2000);
    assert.equal(chats[0].temperature, 0.3);
    assert.match(chats[0].user, /Headline number 1 about the world/);
  });
});

test('thread ids are never the model\'s: topStories and risingThread get the real id (or null) and iso3, countryToWatch gets iso3 and a thread', async () => {
  await withHandler({}, (s) => {
    s.rows['THREAD#thr-1|THREAD_ANALYSIS'] = { threadTitle: 'The Iran thread', entryCount: 4, storyArc: 'arc' };
  }, JSON.stringify(brief({
    topStories: [
      { title: 'Headline number 1 about the world', regions: ['Iran'], threadId: 'model-invented' },
      { title: 'Something no entry matches at all', regions: ['Atlantis'], threadId: 'model-invented' },
    ],
  })), async (mod, { store }) => {
    await mod.handler({});
    const item = store.puts[0].Item;
    assert.equal(item.topStories[0].threadId, 'thr-1');
    assert.deepEqual(item.topStories[0].iso3, ['IRN']);
    assert.equal(item.topStories[1].threadId, null);
    assert.deepEqual(item.topStories[1].iso3, []);
    assert.equal(item.risingThread.threadId, 'thr-1', 'resolved by matching the title against the loaded thread analyses');
    assert.equal(item.countryToWatch.countryName, 'Iran');
    assert.deepEqual(item.countryToWatch.iso3, ['IRN']);
    assert.equal(item.countryToWatch.threadId, 'thr-1'); // the thread with the most entries in that country (first seen wins a tie)
  });
});

test('a rising thread whose title matches no loaded analysis is stored with threadId null, never the model\'s id', async () => {
  await withHandler({}, () => {}, JSON.stringify(brief()), async (mod, { store }) => {
    await mod.handler({});
    assert.equal(store.puts[0].Item.risingThread.threadId, null);
  });
});

test('a model reply wrapped in a ```json fence is accepted', async () => {
  await withHandler({}, () => {}, '```json\n' + JSON.stringify(brief()) + '\n```', async (mod, { store }) => {
    assert.equal((await mod.handler({})).statusCode, 200);
    assert.equal(store.puts[0].Item.headline, 'Talks collapse as the region braces');
  });
});

test('optional parts missing from the reply are stored as empty, not as undefined: no topStories -> [], no risingThread -> null, no countryToWatch -> null, no breakdown -> {}', async () => {
  await withHandler({}, () => {}, JSON.stringify({ headline: 'H', summary: 'S' }), async (mod, { store }) => {
    await mod.handler({});
    const item = store.puts[0].Item;
    assert.deepEqual(item.topStories, []);
    assert.equal(item.risingThread, null);
    assert.equal(item.countryToWatch, null);
    assert.deepEqual(item.categoryBreakdown, {});
  });
});

test('topStories is capped at 8', async () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ title: `Story ${i}`, regions: [] }));
  await withHandler({}, () => {}, JSON.stringify(brief({ topStories: many })), async (mod, { store }) => {
    await mod.handler({});
    assert.equal(store.puts[0].Item.topStories.length, 8);
  });
});

// ── bad model replies: nothing is stored, the handler answers 500 ───────────

for (const [name, reply, message] of [
  ['an empty reply', '', /Empty Grok response/],
  ['a reply that is not JSON', 'Here is your brief: not json', /JSON|Unexpected token/],
  ['a reply with no headline', JSON.stringify({ summary: 'S', topStories: [] }), /Missing required fields: summary, topStories/],
  ['a reply with no summary', JSON.stringify({ headline: 'H' }), /Missing required fields: headline/],
  ['a reply with an empty headline', JSON.stringify({ headline: '', summary: 'S' }), /Missing required fields: headline, summary/],
]) {
  test(`${name}: 500 with the reason, and no DAILY_BRIEF row is written`, async () => {
    await withHandler({}, () => {}, reply, async (mod, { store }) => {
      const r = await mod.handler({});
      assert.equal(r.statusCode, 500);
      assert.equal(body(r).status, 'error');
      assert.match(body(r).error, message);
      assert.equal(store.puts.length, 0);
    });
  });
}

test('a model call that throws is a 500 carrying its message, nothing stored', async () => {
  await withHandler({}, () => {}, () => { throw new Error('upstream 503'); }, async (mod, { store }) => {
    const r = await mod.handler({});
    assert.equal(r.statusCode, 500);
    assert.equal(body(r).error, 'upstream 503');
    assert.equal(store.puts.length, 0);
  });
});

test('a failing DynamoDB Put is a 500 (the brief is not reported as stored)', async () => {
  await withHandler({}, (s) => { s.putThrows = true; }, JSON.stringify(brief()), async (mod) => {
    const r = await mod.handler({});
    assert.equal(r.statusCode, 500);
    assert.equal(body(r).error, 'put denied');
  });
});

// ── handler skip paths ──────────────────────────────────────────────────────

test('no entries archived today (empty archive, or only older entries): 200 skipped, the model is not called', async () => {
  for (const entries of [[], [entry(1, { archivedAt: new Date(Date.now() - 2 * DAY).toISOString() })]]) {
    await withHandler({}, (s) => { s.entries = entries; }, JSON.stringify(brief()), async (mod, { store, chats }) => {
      const r = await mod.handler({});
      assert.equal(r.statusCode, 200);
      assert.deepEqual(body(r), { status: 'skipped', reason: 'no archive entries' });
      assert.equal(chats.length + store.puts.length, 0);
    });
  }
});

test('XAI_API_KEY unset: nothing is generated or stored and the handler answers 200 ok with stored:false (current behaviour, see "Left for a decision")', async () => {
  await withHandler({ XAI_API_KEY: undefined }, () => {}, JSON.stringify(brief()), async (mod, { store, chats }) => {
    const r = await mod.handler({});
    assert.equal(r.statusCode, 200);
    assert.deepEqual(body(r), { status: 'ok', dateKey: TODAY, dailyBrief: { stored: false } });
    assert.equal(chats.length + store.puts.length, 0);
  });
});

test('SUMMARIZE_PREDICT_TABLE unset: same skip, nothing stored', async () => {
  await withHandler({ SUMMARIZE_PREDICT_TABLE: undefined }, () => {}, JSON.stringify(brief()), async (mod, { store, chats }) => {
    const r = await mod.handler({});
    assert.equal(r.statusCode, 200);
    assert.deepEqual(body(r).dailyBrief, { stored: false });
    assert.equal(chats.length + store.puts.length, 0);
  });
});

test('TOPICS_DDB_TABLE unset: 500 naming the missing variable', async () => {
  await withHandler({ TOPICS_DDB_TABLE: undefined }, () => {}, '{}', async (mod) => {
    const r = await mod.handler({});
    assert.equal(r.statusCode, 500);
    assert.match(body(r).error, /TOPICS_DDB_TABLE/);
  });
});
