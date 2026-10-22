'use strict';

// newsBoard — the member's personal board (pins, strings, follows) behind a Lambda Function URL.
// POST body {action, ...}. Every action needs a Firebase JWT except list_presets. See README.md.
//
// CORS is set on the Function URL config; this Lambda must NOT emit Access-Control-* headers (CLAUDE.md).
// Rule from slice 1: every ours-string is stored with strength 'inferred' (the web's own strength is shown
// from WEB#INDEX at read time, never stored as confirmed).

const crypto = require('crypto');
const { pinBudgetOk, PIN_BUDGET, normalizeBoard, normalizeActor } = require('./_shared/record');
const { validateBoard } = require('./validate');
const { presetCache } = require('./presets');
const { connect } = require('./connect');
const { enrichBoard } = require('./recordViews');
const { arrivals } = require('./arrivals');

const MAX_FOLLOWS = 300;
const MAX_NAME = 80;

const httpReply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const ok = (data) => httpReply(200, { success: true, data });
const fail = (status, error, extra = {}) => httpReply(status, { success: false, error, ...extra });

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const publicBoard = ({ savedKey, kind, ...board }) => board; // eslint-disable-line no-unused-vars

/** Server-side rules on a normalised board: budget, schema, ours = inferred, strings join pins on the board. */
function boardProblem(board) {
  if (!pinBudgetOk(board)) return { error: `Pin budget exceeded: a board holds at most ${PIN_BUDGET} pins`, code: 'pin_budget_exceeded', budget: PIN_BUDGET };
  const v = validateBoard(board);
  if (!v.ok) return { error: `Invalid board: ${v.errors.slice(0, 5).join('; ')}`, code: 'invalid_board' };
  const ids = new Set(board.pins.map((p) => p.pinId));
  if (ids.size !== board.pins.length) return { error: 'Invalid board: pinId must be unique', code: 'invalid_board' };
  for (const s of board.strings) {
    if (s.owner === 'ours' && s.strength !== 'inferred') return { error: "Invalid board: every ours-string must have strength 'inferred'", code: 'ours_must_be_inferred' };
    if (!ids.has(s.a) || !ids.has(s.b)) return { error: 'Invalid board: a string must join two pins on the board', code: 'invalid_board' };
  }
  return null;
}

const problemReply = (p) => fail(400, p.error, { code: p.code, ...(p.budget ? { budget: p.budget } : {}) });

function createHandler({ store, verify, records = {active: async () => null, all: async () => null, links: async () => null, story: async () => null}, now = () => Date.now(), env = process.env }) {
  const presets = presetCache(store, env, now);
  const iso = () => new Date(now()).toISOString();

  async function ownBoard(uid, boardId) {
    if (!str(boardId)) return null;
    const item = await store.getBoard(uid, boardId.trim());
    return item && item.uid === uid ? item : null; // another member's data is never returned
  }

  async function saveNew(uid, name, extra) {
    const t = iso();
    const board = normalizeBoard({
      boardId: crypto.randomUUID(), uid, name, pins: [], strings: [], weights: {}, dismissed: [],
      summary: { versions: [] }, ...extra, createdAt: t, updatedAt: t,
    });
    const problem = boardProblem(board);
    if (problem) return { problem };
    await store.putBoard({ ...board, savedKey: `board#${board.boardId}`, kind: 'board' });
    return { board };
  }

  const actions = {
    async list_boards(uid) {
      const items = await store.getBoards(uid);
      return ok(items.filter((b) => b.uid === uid)
        .map((b) => ({ boardId: b.boardId, name: b.name, pinCount: (b.pins || []).length, updatedAt: b.updatedAt }))
        .sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt))));
    },

    async get_board(uid, body) {
      const item = await ownBoard(uid, body.boardId);
      return item ? ok(await enrichBoard(publicBoard(item), records)) : fail(404, 'Board not found');
    },

    async arrivals(uid, body) {
      const item = await ownBoard(uid, body.boardId);
      return item ? ok(await arrivals(publicBoard(item), records, iso())) : fail(404, 'Board not found');
    },
    async visit_board(uid, body) {
      const item = await ownBoard(uid, body.boardId);
      if (!item) return fail(404, 'Board not found');
      // Store visit metadata only; it is not an editorial board change.
      const stamp = iso();
      try { await store.setLastVisited(uid, item.boardId, stamp); }
      catch (e) { if (e.name === 'ConditionalCheckFailedException') return fail(404, 'Board not found'); throw e; }
      return ok({lastVisitedAt: stamp});
    },
    async story_view(uid, body) {
      if (typeof body.threadId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(body.threadId)) return fail(400, 'A valid threadId is required');
      const story = await records.story(body.threadId);
      return ok({recordAvailable: !!story, story});
    },

    async create_board(uid, body) {
      const name = str(body.name);
      if (!name || name.length > MAX_NAME) return fail(400, `name is required (1-${MAX_NAME} characters)`);
      if (body.presetFrom != null && (typeof body.presetFrom !== 'string' || !body.presetFrom || body.presetFrom.length > 64)) return fail(400, 'presetFrom must be a preset id');
      const { board, problem } = await saveNew(uid, name, body.presetFrom ? { presetFrom: body.presetFrom } : {});
      return problem ? problemReply(problem) : ok(board);
    },

    async update_board(uid, body) {
      const stored = await ownBoard(uid, body.boardId);
      if (!stored) return fail(404, 'Board not found');
      const incoming = body.board && { ...body.board };
      if (incoming) {
        delete incoming.recordAvailable;
        delete incoming.lastVisitedAt;
        if (Array.isArray(incoming.pins)) incoming.pins = incoming.pins.map(p => {
          const copy = {...p};
          for (const key of ['recordAvailable','line','risk','born','entryCount','counts','lastMoved']) delete copy[key];
          return copy;
        });
      }
      if (!isObj(incoming)) return fail(400, 'board is required');
      if (incoming.uid !== undefined && incoming.uid !== uid) return fail(400, 'uid cannot change', { code: 'immutable_field' });
      if (incoming.boardId !== undefined && incoming.boardId !== stored.boardId) return fail(400, 'boardId cannot change', { code: 'immutable_field' });
      const board = normalizeBoard({ ...incoming, ...(stored.lastVisitedAt ? {lastVisitedAt: stored.lastVisitedAt} : {}), boardId: stored.boardId, uid, createdAt: stored.createdAt, updatedAt: iso() });
      const problem = boardProblem(board);
      if (problem) return problemReply(problem);
      await store.putBoard({ ...board, savedKey: stored.savedKey, kind: 'board' });
      return ok(await enrichBoard(board, records));
    },

    async delete_board(uid, body) {
      const stored = await ownBoard(uid, body.boardId);
      if (!stored) return fail(404, 'Board not found');
      await store.deleteBoard(uid, stored.boardId);
      return ok({ boardId: stored.boardId });
    },

    async get_follows(uid) { return ok(await store.getFollows(uid)); },

    async follow_thread(uid, body) {
      const id = str(body.threadId);
      if (!id || id.length > 200) return fail(400, 'threadId is required');
      const cur = await store.getFollows(uid);
      const has = cur.followedThreads.includes(id);
      if (cur.followedThreads.length >= MAX_FOLLOWS && !has) return fail(400, `You can follow at most ${MAX_FOLLOWS} threads`);
      if (has) return ok(cur);
      const next = { ...cur, followedThreads: [...cur.followedThreads, id] };
      await store.setFollows(uid, { followedThreads: next.followedThreads });
      return ok(next);
    },

    async unfollow_thread(uid, body) {
      const id = str(body.threadId);
      if (!id) return fail(400, 'threadId is required');
      const cur = await store.getFollows(uid);
      if (!cur.followedThreads.includes(id)) return ok(cur);
      const next = { ...cur, followedThreads: cur.followedThreads.filter((t) => t !== id) };
      await store.setFollows(uid, { followedThreads: next.followedThreads });
      return ok(next);
    },

    async follow_actor(uid, body) {
      const name = str(body.name).replace(/\s+/g, ' ');
      if (!name || name.length > 200) return fail(400, 'name is required');
      const cur = await store.getFollows(uid);
      const has = cur.followedActors.some((a) => normalizeActor(a) === normalizeActor(name));
      if (cur.followedActors.length >= MAX_FOLLOWS && !has) return fail(400, `You can follow at most ${MAX_FOLLOWS} actors`);
      if (has) return ok(cur);
      const next = { ...cur, followedActors: [...cur.followedActors, name] };
      await store.setFollows(uid, { followedActors: next.followedActors });
      return ok(next);
    },

    async unfollow_actor(uid, body) {
      const name = str(body.name);
      if (!name) return fail(400, 'name is required');
      const cur = await store.getFollows(uid);
      const kept = cur.followedActors.filter((a) => normalizeActor(a) !== normalizeActor(name));
      if (kept.length === cur.followedActors.length) return ok(cur);
      await store.setFollows(uid, { followedActors: kept });
      return ok({ ...cur, followedActors: kept });
    },

    async list_presets() { return ok(await presets()); },

    async fork_preset(uid, body) {
      const preset = (await presets()).find((p) => p.presetId === body.presetId);
      if (!preset) return fail(404, 'Preset not found');
      const name = str(body.name) || preset.name;
      if (name.length > MAX_NAME) return fail(400, `name is at most ${MAX_NAME} characters`);
      const t = iso();
      const pins = preset.pins.map((p) => ({ pinId: p.pinId, kind: p.kind, refId: p.refId, addedAt: t }));
      const strings = preset.strings.map((s) => ({ ...s, keptAt: t }));
      const { board, problem } = await saveNew(uid, name, { pins, strings, presetFrom: preset.presetId });
      return problem ? problemReply(problem) : ok(board);
    },

    async connect(uid, body) {
      const out = await connect(store, env, now(), body.a, body.b);
      return out.error ? fail(400, out.error) : ok(out.result);
    },
  };
  const PUBLIC = new Set(['list_presets', 'story_view']);

  return async function handler(event) {
    try {
      const method = event.requestContext?.http?.method || event.httpMethod;
      if (method === 'OPTIONS') return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '' }; // preflight is the URL config's job
      let body;
      try {
        const raw = event.isBase64Encoded && typeof event.body === 'string' ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
        body = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
      } catch {
        return fail(400, 'Invalid JSON body');
      }
      if (!isObj(body)) return fail(400, 'Invalid JSON body');
      const fn = typeof body.action === 'string' && Object.prototype.hasOwnProperty.call(actions, body.action) ? actions[body.action] : null;
      if (!fn) return fail(400, 'Unsupported action');
      let uid = null;
      if (!PUBLIC.has(body.action)) {
        const payload = await verify(event.headers?.authorization || event.headers?.Authorization || '');
        if (!payload || !payload.sub) return fail(401, 'Sign in required');
        uid = payload.sub;
      }
      return await fn(uid, body);
    } catch (err) {
      console.error('newsBoard error', err);
      return fail(500, 'Request failed');
    }
  };
}

let _handler = null;
exports.createHandler = createHandler;
exports.handler = async (event) => {
  if (!_handler) {
    const { makeStore } = require('./store');
    const { verifyFirebaseToken } = require('./firebaseAuth');
    const { liveRecordViews } = require('./recordViews');
    _handler = createHandler({ store: makeStore(), verify: verifyFirebaseToken, records: liveRecordViews() });
  }
  return _handler(event);
};
