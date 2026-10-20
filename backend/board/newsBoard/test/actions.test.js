'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, validBoardBody } = require('./helpers');

const ids = (r) => r.data.map((b) => b.boardId);

test('no token and a bad token are 401 for every member action; list_presets is public', async () => {
  const { call, handler } = setup();
  for (const action of ['list_boards', 'get_board', 'create_board', 'update_board', 'delete_board', 'follow_thread', 'unfollow_thread', 'follow_actor', 'unfollow_actor', 'get_follows', 'fork_preset', 'connect']) {
    assert.equal((await call(null, { action, name: 'x' })).status, 401, action);
  }
  const bad = await handler({ headers: { authorization: 'Token nope' }, body: JSON.stringify({ action: 'list_boards' }) });
  assert.equal(bad.statusCode, 401);
  const pub = await call(null, { action: 'list_presets' });
  assert.equal(pub.status, 200);
});

test('bad JSON, unknown and inherited action names are 400; no CORS headers are emitted', async () => {
  const { call, handler } = setup();
  const res = await handler({ headers: {}, body: '{nope' });
  assert.equal(res.statusCode, 400);
  assert.equal((await call('u1', { action: 'drop_tables' })).status, 400);
  assert.equal((await call('u1', { action: 'constructor' })).status, 400);
  const ok = await handler({ headers: {}, body: JSON.stringify({ action: 'list_presets' }) });
  assert.ok(!Object.keys(ok.headers).some((h) => /^access-control-/i.test(h)));
});

test('create, list, get, update, delete a board', async () => {
  const { call, store } = setup();
  const made = await call('u1', { action: 'create_board', name: '  Gulf  ' });
  assert.equal(made.status, 200);
  const b = made.data;
  assert.equal(b.name, 'Gulf');
  assert.equal(b.uid, 'u1');
  assert.deepEqual([b.pins, b.strings, b.dismissed], [[], [], []]);
  assert.match(b.boardId, /^[0-9a-f-]{36}$/);
  assert.ok(store.rows.get(`saved|u1|board#${b.boardId}`).kind === 'board');

  const list = await call('u1', { action: 'list_boards' });
  assert.deepEqual(list.data.map((x) => [x.boardId, x.name, x.pinCount]), [[b.boardId, 'Gulf', 0]]);
  assert.deepEqual(Object.keys(list.data[0]).sort(), ['boardId', 'name', 'pinCount', 'updatedAt']);

  const upd = await call('u1', { action: 'update_board', boardId: b.boardId, board: validBoardBody() });
  assert.equal(upd.status, 200);
  assert.equal(upd.data.pins.length, 2);
  assert.equal(upd.data.strings[0].a, 'p1'); // normalised: a < b
  assert.equal(upd.data.uid, 'u1');
  assert.equal(upd.data.createdAt, b.createdAt);

  const got = await call('u1', { action: 'get_board', boardId: b.boardId });
  assert.equal(got.status, 200);
  assert.ok(!('savedKey' in got.data) && !('kind' in got.data));
  assert.equal(got.data.pins.length, 2);
  assert.equal((await call('u1', { action: 'list_boards' })).data[0].pinCount, 2);

  const del = await call('u1', { action: 'delete_board', boardId: b.boardId });
  assert.equal(del.status, 200);
  assert.equal((await call('u1', { action: 'get_board', boardId: b.boardId })).status, 404);
  assert.deepEqual((await call('u1', { action: 'list_boards' })).data, []);
});

test('updatedAt is set by the server and createdAt/uid/boardId are kept', async () => {
  const { call, setNow } = setup();
  const b = (await call('u1', { action: 'create_board', name: 'A' })).data;
  setNow(Date.parse('2026-10-21T00:00:00.000Z'));
  const upd = await call('u1', { action: 'update_board', boardId: b.boardId, board: validBoardBody({ updatedAt: '1999-01-01T00:00:00.000Z', createdAt: '1999-01-01T00:00:00.000Z' }) });
  assert.equal(upd.data.updatedAt, '2026-10-21T00:00:00.000Z');
  assert.equal(upd.data.createdAt, b.createdAt);
  assert.equal(upd.data.boardId, b.boardId);
});

test('uid and boardId cannot change', async () => {
  const { call } = setup();
  const b = (await call('u1', { action: 'create_board', name: 'A' })).data;
  const a = await call('u1', { action: 'update_board', boardId: b.boardId, board: validBoardBody({ uid: 'u2' }) });
  assert.equal(a.status, 400);
  assert.match(a.error, /uid cannot change/);
  const c = await call('u1', { action: 'update_board', boardId: b.boardId, board: validBoardBody({ boardId: 'other' }) });
  assert.equal(c.status, 400);
  assert.match(c.error, /boardId cannot change/);
});

test("another member's board is 404 for get, update and delete, and is not listed", async () => {
  const { call, store } = setup();
  const b = (await call('u1', { action: 'create_board', name: 'Mine' })).data;
  for (const body of [
    { action: 'get_board', boardId: b.boardId },
    { action: 'update_board', boardId: b.boardId, board: validBoardBody() },
    { action: 'delete_board', boardId: b.boardId },
  ]) {
    const r = await call('u2', body);
    assert.equal(r.status, 404, body.action);
    assert.equal(r.data, undefined);
  }
  assert.ok(store.rows.has(`saved|u1|board#${b.boardId}`), 'still there');
  assert.deepEqual((await call('u2', { action: 'list_boards' })).data, []);
  assert.equal((await call('u1', { action: 'get_board', boardId: 'missing' })).status, 404);
});

test('pin budget: 12 pins pass, 13 are rejected with a budget code', async () => {
  const { call } = setup();
  const b = (await call('u1', { action: 'create_board', name: 'A' })).data;
  const pins = (n) => Array.from({ length: n }, (_, i) => ({ pinId: `p${String(i).padStart(2, '0')}`, kind: 'thread', refId: `t-${i}`, addedAt: '2026-10-20T08:00:00.000Z' }));
  const twelve = await call('u1', { action: 'update_board', boardId: b.boardId, board: validBoardBody({ pins: pins(12), strings: [] }) });
  assert.equal(twelve.status, 200);
  const thirteen = await call('u1', { action: 'update_board', boardId: b.boardId, board: validBoardBody({ pins: pins(13), strings: [] }) });
  assert.equal(thirteen.status, 400);
  assert.equal(thirteen.code, 'pin_budget_exceeded');
  assert.equal(thirteen.budget, 12);
  assert.equal((await call('u1', { action: 'get_board', boardId: b.boardId })).data.pins.length, 12, 'the stored board is unchanged');
});

test('schema rejection: unknown field, bad enum, missing name, long mechanism, dangling string, duplicate pinId', async () => {
  const { call } = setup();
  const b = (await call('u1', { action: 'create_board', name: 'A' })).data;
  const bad = async (over, re) => {
    const r = await call('u1', { action: 'update_board', boardId: b.boardId, board: validBoardBody(over) });
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.match(r.error, re);
  };
  await bad({ surprise: 1 }, /surprise: not allowed/);
  await bad({ pins: [{ pinId: 'p1', kind: 'planet', refId: 'x', addedAt: '2026-10-20T08:00:00.000Z' }], strings: [] }, /kind: must be one of/);
  await bad({ name: '' }, /name/);
  await bad({ strings: [{ a: 'p1', b: 'p2', owner: 'yours', line: 'x'.repeat(281) }] }, /line: too long/);
  await bad({ strings: [{ a: 'p1', b: 'ghost', owner: 'yours', line: 'x' }] }, /join two pins/);
  await bad({ pins: [{ pinId: 'p1', kind: 'thread', refId: 'a', addedAt: '2026-10-20T08:00:00.000Z' }, { pinId: 'p1', kind: 'thread', refId: 'b', addedAt: '2026-10-20T08:00:00.000Z' }], strings: [] }, /pinId must be unique/);
  const noBoard = await call('u1', { action: 'update_board', boardId: b.boardId });
  assert.equal(noBoard.status, 400);
});

test("an ours-string must be 'inferred': medium, strong, weak and missing strength are rejected; yours is free", async () => {
  const { call } = setup();
  const b = (await call('u1', { action: 'create_board', name: 'A' })).data;
  for (const strength of ['medium', 'strong', 'weak', undefined]) {
    const r = await call('u1', { action: 'update_board', boardId: b.boardId, board: validBoardBody({ strings: [{ a: 'p1', b: 'p2', owner: 'ours', strength }] }) });
    assert.equal(r.status, 400, String(strength));
    assert.equal(r.code, 'ours_must_be_inferred');
  }
  const mine = await call('u1', { action: 'update_board', boardId: b.boardId, board: validBoardBody({ strings: [{ a: 'p1', b: 'p2', owner: 'yours', line: 'my claim' }] }) });
  assert.equal(mine.status, 200);
});

test('duplicate pins and strings are folded by normalizeBoard (one string per pair, later keptAt wins)', async () => {
  const { call } = setup();
  const b = (await call('u1', { action: 'create_board', name: 'A' })).data;
  const r = await call('u1', { action: 'update_board', boardId: b.boardId, board: validBoardBody({
    strings: [
      { a: 'p1', b: 'p2', owner: 'ours', strength: 'inferred', mechanism: 'old', keptAt: '2026-10-20T08:00:00.000Z' },
      { a: 'p2', b: 'p1', owner: 'yours', line: 'new', keptAt: '2026-10-20T09:00:00.000Z' },
    ],
  }) });
  assert.equal(r.status, 200);
  assert.equal(r.data.strings.length, 1);
  assert.equal(r.data.strings[0].owner, 'yours');
});

test('create_board with presetFrom records it; bad names are 400', async () => {
  const { call } = setup();
  assert.equal((await call('u1', { action: 'create_board', name: 'A', presetFrom: 'preset-europe' })).data.presetFrom, 'preset-europe');
  assert.equal((await call('u1', { action: 'create_board', name: '' })).status, 400);
  assert.equal((await call('u1', { action: 'create_board', name: 'x'.repeat(81) })).status, 400);
  assert.equal((await call('u1', { action: 'create_board' })).status, 400);
});

test('follow / unfollow thread and actor are idempotent and touch only their own attribute', async () => {
  const { call, store } = setup();
  store.rows.set('prefs|u1|', { uid: 'u1', followedCountries: ['Iran'], digestOptIn: true, email: 'a@b.c' });
  const t1 = await call('u1', { action: 'follow_thread', threadId: 'thread-a' });
  const t2 = await call('u1', { action: 'follow_thread', threadId: 'thread-a' });
  assert.deepEqual(t1.data.followedThreads, ['thread-a']);
  assert.deepEqual(t2.data.followedThreads, ['thread-a']);
  assert.equal(store.calls.filter((c) => c[0] === 'setFollows').length, 1, 'second follow writes nothing');

  const a1 = await call('u1', { action: 'follow_actor', name: '  Strait   of Hormuz ' });
  const a2 = await call('u1', { action: 'follow_actor', name: 'strait of hormuz' });
  assert.deepEqual(a1.data.followedActors, ['Strait of Hormuz']);
  assert.deepEqual(a2.data.followedActors, ['Strait of Hormuz']);

  const row = store.rows.get('prefs|u1|');
  assert.deepEqual(row.followedCountries, ['Iran']);
  assert.equal(row.digestOptIn, true);
  assert.equal(row.email, 'a@b.c');
  for (const c of store.calls.filter((x) => x[0] === 'setFollows')) assert.ok(c[1].length === 1 && /^followed(Threads|Actors)$/.test(c[1][0]));

  const u1 = await call('u1', { action: 'unfollow_actor', name: 'STRAIT OF HORMUZ' });
  assert.deepEqual(u1.data.followedActors, []);
  const u2 = await call('u1', { action: 'unfollow_actor', name: 'Strait of Hormuz' });
  assert.deepEqual(u2.data.followedActors, []);
  const ut = await call('u1', { action: 'unfollow_thread', threadId: 'thread-a' });
  assert.deepEqual(ut.data.followedThreads, []);
  assert.equal((await call('u1', { action: 'unfollow_thread', threadId: 'thread-never' })).status, 200);
  assert.deepEqual((await call('u1', { action: 'get_follows' })).data, { followedThreads: [], followedActors: [] });
  assert.deepEqual(store.rows.get('prefs|u1|').followedCountries, ['Iran']);
  assert.equal((await call('u1', { action: 'follow_thread' })).status, 400);
  assert.equal((await call('u1', { action: 'follow_actor', name: '   ' })).status, 400);
});

test('follows are per member; a new member starts empty', async () => {
  const { call } = setup();
  await call('u1', { action: 'follow_thread', threadId: 'thread-a' });
  assert.deepEqual((await call('u2', { action: 'get_follows' })).data, { followedThreads: [], followedActors: [] });
});

test('list_presets: one preset per region with at least two analysed threads, highest risk first, strings inferred', async () => {
  const { call } = setup();
  const r = await call(null, { action: 'list_presets' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.map((p) => p.presetId), ['preset-middle-east'], 'Europe has one thread, nowhere has no region');
  const p = r.data[0];
  assert.equal(p.region, 'Middle East');
  assert.deepEqual(p.pins.map((x) => x.refId), ['thread-hormuz', 'thread-gaza', 'thread-oil']);
  assert.deepEqual(p.pins.map((x) => x.pinId), ['p01', 'p02', 'p03']);
  assert.deepEqual(Object.keys(p.pins[0]).sort(), ['kind', 'lead', 'pinId', 'refId', 'riskScore', 'title']);
  assert.ok(p.strings.length >= 2);
  for (const s of p.strings) {
    assert.equal(s.owner, 'ours');
    assert.equal(s.strength, 'inferred');
    assert.ok(s.a < s.b);
  }
  const oilLink = p.strings.find((s) => s.a === 'p01' && s.b === 'p03');
  assert.match(oilLink.mechanism, /closure raises crude/, 'the causal link wins over the shared-actor string');
});

test('list_presets is cached for 10 minutes', async () => {
  const { call, store, setNow } = setup();
  const first = await call(null, { action: 'list_presets' });
  store.put('world', 'THREAD#thread-hormuz', 'THREAD_ANALYSIS', { threadId: 'thread-hormuz', threadTitle: 'Changed', riskScore: 1, iso3: ['IRN'] });
  const cached = await call(null, { action: 'list_presets' });
  assert.deepEqual(cached.data, first.data);
  setNow(Date.parse('2026-10-20T12:11:00.000Z'));
  const fresh = await call(null, { action: 'list_presets' });
  assert.notEqual(fresh.data[0].pins[0].refId, 'thread-hormuz');
});

test('fork_preset creates an owned, valid copy with presetFrom; unknown preset is 404', async () => {
  const { call, store } = setup();
  const r = await call('u1', { action: 'fork_preset', presetId: 'preset-middle-east' });
  assert.equal(r.status, 200);
  assert.equal(r.data.uid, 'u1');
  assert.equal(r.data.presetFrom, 'preset-middle-east');
  assert.equal(r.data.pins.length, 3);
  assert.ok(r.data.strings.every((s) => s.owner === 'ours' && s.strength === 'inferred'));
  assert.ok(store.rows.has(`saved|u1|board#${r.data.boardId}`));
  assert.equal((await call('u2', { action: 'get_board', boardId: r.data.boardId })).status, 404);
  const named = await call('u1', { action: 'fork_preset', presetId: 'preset-middle-east', name: 'Mine' });
  assert.equal(named.data.name, 'Mine');
  assert.equal((await call('u1', { action: 'fork_preset', presetId: 'preset-mars' })).status, 404);
  assert.equal((await call('u1', { action: 'list_boards' })).data.length, 2);
});

test('connect: shared actor + co-movement -> medium grounds, pairKey, outlets noted', async () => {
  const { call } = setup();
  const r = await call('u1', { action: 'connect', a: { kind: 'thread', refId: 'thread-oil' }, b: { kind: 'thread', refId: 'thread-hormuz' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.pairKey, 'thread-hormuz__thread-oil');
  assert.equal(r.data.strength, 'medium');
  const kinds = r.data.grounds.map((g) => g.kind);
  assert.deepEqual(kinds.sort(), ['actor', 'comovement', 'outlet']);
  assert.deepEqual(r.data.grounds.find((g) => g.kind === 'comovement').detail, { lagDays: 1, pairs: 2 });
  assert.deepEqual(r.data.grounds.find((g) => g.kind === 'outlet').detail.outlets, ['reuters.com']);
  assert.deepEqual(r.data.limits, []);
});

test('connect: the honest none, with limits listing what could not be read', async () => {
  const { call } = setup();
  const r = await call('u1', { action: 'connect', a: { kind: 'thread', refId: 'thread-eu' }, b: { kind: 'thread', refId: 'thread-gaza' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.strength, 'none');
  assert.deepEqual(r.data.grounds, []);
  assert.equal(r.data.note, 'No link found. Shared: nothing but the week.');
  assert.ok(r.data.limits.some((l) => /outlets unavailable for thread thread-eu/.test(l)));
});

test('connect: country and actor pins; bad pins and identical pins are 400', async () => {
  const { call } = setup();
  const c = await call('u1', { action: 'connect', a: { kind: 'country', refId: 'Iran' }, b: { kind: 'thread', refId: 'thread-hormuz' } });
  assert.equal(c.status, 200);
  assert.equal(c.data.a.refId, 'IRN');
  assert.ok(c.data.grounds.some((g) => g.kind === 'place' && g.detail.includes('IRN')));
  assert.ok(c.data.grounds.some((g) => g.kind === 'actor'));
  const a = await call('u1', { action: 'connect', a: { kind: 'actor', refId: ' strait of  hormuz' }, b: { kind: 'thread', refId: 'thread-hormuz' } });
  assert.equal(a.data.pairKey, 'strait of hormuz__thread-hormuz');
  assert.ok(a.data.grounds.some((g) => g.kind === 'actor'));
  assert.equal((await call('u1', { action: 'connect', a: { kind: 'planet', refId: 'x' }, b: { kind: 'actor', refId: 'y' } })).status, 400);
  assert.equal((await call('u1', { action: 'connect', a: { kind: 'country', refId: 'Narnia' }, b: { kind: 'actor', refId: 'y' } })).status, 400);
  assert.equal((await call('u1', { action: 'connect', a: { kind: 'actor', refId: 'X' }, b: { kind: 'actor', refId: ' x ' } })).status, 400);
});

test('connect writes nothing', async () => {
  const { call, store } = setup();
  const before = store.rows.size;
  await call('u1', { action: 'connect', a: { kind: 'thread', refId: 'thread-oil' }, b: { kind: 'thread', refId: 'thread-hormuz' } });
  assert.equal(store.rows.size, before);
  assert.deepEqual(store.calls, []);
});

test('with no world data every read degrades to empty, not an error', async () => {
  const { call } = setup({ withWorld: false });
  assert.deepEqual((await call(null, { action: 'list_presets' })).data, []);
  const r = await call('u1', { action: 'connect', a: { kind: 'thread', refId: 't1' }, b: { kind: 'thread', refId: 't2' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.strength, 'none');
});

test('listing boards never mixes in other items of the saved-items table', async () => {
  const { call, store } = setup();
  store.rows.set('saved|u1|thread#t1', { uid: 'u1', savedKey: 'thread#t1', itemType: 'thread', itemId: 't1' });
  const b = (await call('u1', { action: 'create_board', name: 'A' })).data;
  assert.deepEqual(ids(await call('u1', { action: 'list_boards' })), [b.boardId]);
});
