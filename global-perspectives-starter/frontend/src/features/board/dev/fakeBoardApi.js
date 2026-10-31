// DEV ONLY. An in-memory stand-in for the newsBoard Lambda, used when window.BOARD_ENDPOINT is unset in a dev
// build (lib/boardApi.js imports it dynamically behind import.meta.env.DEV, so production builds drop it).
// It implements the same actions and reply shapes. Thread ids and titles come from today's live topics when the
// topics call works (so titles and risk numbers resolve through the normal path); otherwise from a small fixture
// with plausible ids that the live site does not know (titles then come from the preset's own pins). Connect
// grounds are computed from the topics' actors, places and outlets; there is no score history here, so no
// co-movement ground ever appears. State lives in this tab's sessionStorage.
import { devRecordIndex } from './fakeRecordViews.js';
import { contentService } from '@/shared/data/contentService';
import { pairKey, normalizeActor, PIN_BUDGET } from '@/shared/lib/board.js';
import { resolveCountry } from '@/shared/lib/countries.js';

const STORE_KEY = 'gp_dev_board_store';
const NO_LINK = 'No link found. Shared: nothing but the week.';
const OUTLET_NOTE = 'coverage artefact possible';

const FIXTURE_TOPICS = [
  { threadId: 'thread-fx-strait-shipping', title: 'Shipping through the Strait of Hormuz', actors: ['Iran', 'US Navy', 'Maersk'], iso3: ['IRN', 'ARE'], sources: [{ source: 'Reuters' }, { source: 'BBC' }] },
  { threadId: 'thread-fx-gulf-ceasefire', title: 'Gulf ceasefire talks in Muscat', actors: ['Iran', 'Oman'], iso3: ['IRN', 'OMN'], sources: [{ source: 'Reuters' }, { source: 'Al Jazeera' }] },
  { threadId: 'thread-fx-oil-price', title: 'Brent crude after the OPEC+ meeting', actors: ['OPEC+', 'Saudi Arabia'], iso3: ['SAU'], sources: [{ source: 'Bloomberg' }] },
  { threadId: 'thread-fx-ukraine-grain', title: 'Black Sea grain corridor renewal', actors: ['Ukraine', 'Turkey'], iso3: ['UKR', 'TUR'], sources: [{ source: 'Reuters' }] },
  { threadId: 'thread-fx-sahel-coup', title: 'Sahel junta and the ECOWAS response', actors: ['ECOWAS', 'Niger'], iso3: ['NER', 'MLI'], sources: [{ source: 'France 24' }] },
  { threadId: 'thread-fx-taiwan-drills', title: 'PLA drills around Taiwan', actors: ['China', 'Taiwan'], iso3: ['CHN', 'TWN'], sources: [{ source: 'BBC' }, { source: 'Reuters' }] },
];

let topicsPromise = null;
function topics() {
  if (!topicsPromise) {
    topicsPromise = contentService.getGeminiTopics(13)
      .then((d) => (Array.isArray(d?.topics) ? d.topics.filter((t) => t.threadId && t.title) : []))
      .catch(() => [])
      .then((list) => (list.length >= 4 ? list : FIXTURE_TOPICS));
  }
  return topicsPromise;
}

function load() {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) || null; } catch { return null; }
}
let db = load() || { boards: {}, follows: { followedThreads: [], followedActors: [] } };
const persist = () => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* storage unavailable */ } };

const pinIdAt = (i) => `p${String(i + 1).padStart(2, '0')}`;
const fail = (status, error, extra = {}) => Object.assign(new Error(error), { status, ...extra });

async function presets() {
  const list = await topics();
  const groups = [list.slice(0, 5), list.slice(5, 10)].filter((g) => g.length >= 2);
  return groups.map((g, gi) => {
    const pins = g.map((t, i) => ({ pinId: pinIdAt(i), kind: 'thread', refId: t.threadId, title: t.title }));
    const strings = [];
    for (let i = 0; i < g.length; i += 1) {
      for (let j = i + 1; j < g.length; j += 1) {
        const shared = (g[i].actors || []).filter((a) => (g[j].actors || []).some((b) => normalizeActor(a) === normalizeActor(b)));
        if (shared.length) strings.push({ a: pins[i].pinId, b: pins[j].pinId, owner: 'ours', strength: 'inferred', mechanism: `Shared actors: ${shared.join(', ')}` });
      }
    }
    return { presetId: `dev-preset-${gi + 1}`, name: gi === 0 ? 'Dev set A: the first five stories today' : 'Dev set B: the next stories today', region: 'Dev', pins, strings };
  });
}

function own(board) {
  const { savedKey, kind, ...rest } = board; // eslint-disable-line no-unused-vars
  return rest;
}

function checkBoard(board) {
  if (board.pins.length > PIN_BUDGET) throw fail(400, `Pin budget exceeded: a board holds at most ${PIN_BUDGET} pins`, { code: 'pin_budget_exceeded', budget: PIN_BUDGET });
  const ids = new Set(board.pins.map((p) => p.pinId));
  for (const s of board.strings) {
    if (!ids.has(s.a) || !ids.has(s.b)) throw fail(400, 'Invalid board: a string must join two pins on the board', { code: 'invalid_board' });
    if (s.owner === 'ours' && s.strength !== 'inferred') throw fail(400, "Invalid board: every ours-string must have strength 'inferred'", { code: 'ours_must_be_inferred' });
    if (s.line && s.line.length > 280) throw fail(400, 'Invalid board: line is at most 280 characters', { code: 'invalid_board' });
  }
}

function normalise(board) {
  const byPair = new Map();
  for (const s of board.strings || []) {
    if (s.a === s.b) continue;
    const o = s.a < s.b ? { ...s } : { ...s, a: s.b, b: s.a };
    byPair.set(pairKey(o.a, o.b), o);
  }
  return { ...board, strings: [...byPair.values()] };
}

async function dataOf(pin) {
  if (pin.kind === 'thread') {
    const t = (await topics()).find((x) => x.threadId === pin.refId);
    return { actors: t?.actors || [], places: t?.iso3 || [], outlets: [...new Set((t?.sources || []).map((s) => s.source).filter(Boolean))], known: !!t };
  }
  if (pin.kind === 'country') {
    const c = resolveCountry(pin.refId);
    return { actors: c ? [c.name] : [], places: c ? [c.iso3] : [], outlets: [], known: !!c };
  }
  const asCountry = resolveCountry(pin.refId);
  return { actors: [pin.refId], places: asCountry ? [asCountry.iso3] : [], outlets: [], known: true };
}

async function connect(a, b) {
  for (const p of [a, b]) if (!p || !['thread', 'country', 'actor'].includes(p.kind) || !p.refId) throw fail(400, 'a and b must be {kind: thread|country|actor, refId}');
  const [da, db2] = await Promise.all([dataOf(a), dataOf(b)]);
  const both = (x, y, norm = (v) => v) => [...new Set(x.map(norm))].filter((v) => y.map(norm).includes(v));
  const grounds = [];
  const kinds = new Set();
  const actors = both(da.actors, db2.actors, normalizeActor).filter(Boolean);
  if (actors.length) { grounds.push({ kind: 'actor', detail: actors }); kinds.add('actor'); }
  const places = both(da.places, db2.places);
  if (places.length) { grounds.push({ kind: 'place', detail: places }); kinds.add('place'); }
  const outlets = both(da.outlets, db2.outlets);
  if (outlets.length) grounds.push({ kind: 'outlet', detail: { outlets, note: OUTLET_NOTE } });
  const strength = kinds.size >= 2 ? 'medium' : (kinds.size === 1 || outlets.length) ? 'weak' : 'none';
  const note = strength === 'none' ? NO_LINK
    : !kinds.size ? `Shared outlets only: ${OUTLET_NOTE}.`
      : `Shared: ${[...kinds].join(' + ')}.${outlets.length ? ` Shared outlets add nothing (${OUTLET_NOTE}).` : ''}`;
  const limits = ['dev fake: no score history, so co-movement is not tested'];
  for (const [p, d] of [[a, da], [b, db2]]) if (!d.known) limits.push(`no data for ${p.kind} ${p.refId} in the dev topics`);
  const key = (p) => (p.kind === 'actor' ? normalizeActor(p.refId) : p.kind === 'country' ? (resolveCountry(p.refId)?.iso3 || p.refId) : p.refId);
  return { pairKey: pairKey(key(a), key(b)), a: { kind: a.kind, refId: a.refId }, b: { kind: b.kind, refId: b.refId }, strength, grounds, note, limits };
}

function seedFollows() {
  return topics().then((list) => {
    if (db.follows.followedThreads.length || db.follows.followedActors.length || db.seeded) return;
    db.follows = { followedThreads: list.slice(0, 2).map((t) => t.threadId), followedActors: [...new Set(list.flatMap((t) => t.actors || []))].slice(0, 2) };
    db.seeded = true;
    persist();
  });
}

const MAX_NAME = 80;
const newId = () => `dev-${Math.random().toString(36).slice(2, 10)}`;

export async function fakeBoardAction(action, body = {}) {
  await new Promise((r) => setTimeout(r, 120)); // a little latency so loading states are seen
  const now = new Date().toISOString();
  const boardOf = (id) => { const b = db.boards[id]; if (!b) throw fail(404, 'Board not found'); return b; };
  const mode = new URLSearchParams(window.location.search).get('devRecord');
  const available = mode === '1';
  if (mode && !db.boards['dev-record']) {
    db.boards['dev-record'] = { boardId:'dev-record', uid:'dev-member', name:'Record views example', pins:[{pinId:'p1',kind:'thread',refId:devRecordIndex[0].threadId,addedAt:now},{pinId:'p2',kind:'thread',refId:devRecordIndex[1].threadId,addedAt:now},{pinId:'p3',kind:'thread',refId:devRecordIndex[2].threadId,addedAt:now}], strings:[], weights:{}, dismissed:[], summary:{versions:[]},createdAt:now,updatedAt:now };
    persist();
  }
  switch (action) {
    case 'list_boards':
      return Object.values(db.boards).map((b) => ({ boardId: b.boardId, name: b.name, pinCount: b.pins.length, updatedAt: b.updatedAt }))
        .sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
    case 'get_board': {
      const board = own(boardOf(body.boardId));
      return { ...board, recordAvailable:available, pins:board.pins.map((p) => { const row = devRecordIndex.find((r) => r.threadId === p.refId); return available && row ? {...p,recordAvailable:true,line:row.line ?? null,born:row.born,entryCount:row.entryCount,counts:{chapters:null,liveBranches:row.liveBranchCount,confirmedLinks:null},lastMoved:row.lastFactAt} : p; }) };
    }
    case 'arrivals': return {recordAvailable:available,since:boardOf(body.boardId).lastVisitedAt || boardOf(body.boardId).createdAt,arrivals:[]};
    case 'visit_board': {const b=boardOf(body.boardId);b.lastVisitedAt=now;persist();return {lastVisitedAt:now};}
    case 'create_board': {
      const name = String(body.name || '').trim();
      if (!name || name.length > MAX_NAME) throw fail(400, `name is required (1-${MAX_NAME} characters)`);
      const b = { boardId: newId(), uid: 'dev-member', name, pins: [], strings: [], weights: {}, dismissed: [], summary: { versions: [] }, ...(body.presetFrom ? { presetFrom: body.presetFrom } : {}), createdAt: now, updatedAt: now };
      db.boards[b.boardId] = b; persist();
      return own(b);
    }
    case 'update_board': {
      const stored = boardOf(body.boardId);
      const incoming = body.board;
      if (!incoming || typeof incoming !== 'object') throw fail(400, 'board is required');
      if (incoming.boardId !== undefined && incoming.boardId !== stored.boardId) throw fail(400, 'boardId cannot change', { code: 'immutable_field' });
      const next = normalise({ ...incoming, boardId: stored.boardId, uid: stored.uid, createdAt: stored.createdAt, updatedAt: now });
      if (!String(next.name || '').trim()) throw fail(400, 'Invalid board: name is required', { code: 'invalid_board' });
      checkBoard(next);
      db.boards[next.boardId] = next; persist();
      return own(next);
    }
    case 'delete_board': boardOf(body.boardId); delete db.boards[body.boardId]; persist(); return { boardId: body.boardId };
    case 'get_follows': await seedFollows(); return { ...db.follows };
    case 'follow_thread': await seedFollows(); if (!db.follows.followedThreads.includes(body.threadId)) db.follows.followedThreads.push(body.threadId); persist(); return { ...db.follows };
    case 'unfollow_thread': db.follows.followedThreads = db.follows.followedThreads.filter((t) => t !== body.threadId); persist(); return { ...db.follows };
    case 'follow_actor': {
      await seedFollows();
      const name = String(body.name || '').trim().replace(/\s+/g, ' ');
      if (!name) throw fail(400, 'name is required');
      if (!db.follows.followedActors.some((a) => normalizeActor(a) === normalizeActor(name))) db.follows.followedActors.push(name);
      persist();
      return { ...db.follows };
    }
    case 'unfollow_actor': db.follows.followedActors = db.follows.followedActors.filter((a) => normalizeActor(a) !== normalizeActor(body.name)); persist(); return { ...db.follows };
    case 'list_presets': return presets();
    case 'fork_preset': {
      const p = (await presets()).find((x) => x.presetId === body.presetId);
      if (!p) throw fail(404, 'Preset not found');
      const b = {
        boardId: newId(), uid: 'dev-member', name: String(body.name || '').trim() || p.name, presetFrom: p.presetId,
        pins: p.pins.map(({ pinId, kind, refId }) => ({ pinId, kind, refId, addedAt: now })),
        strings: p.strings.map((s) => ({ ...s, keptAt: now })), weights: {}, dismissed: [], summary: { versions: [] }, createdAt: now, updatedAt: now,
      };
      db.boards[b.boardId] = b; persist();
      return own(b);
    }
    case 'connect': return connect(body.a, body.b);
    default: throw fail(400, 'Unsupported action');
  }
}
