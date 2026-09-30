// newsSharedAnalysis — Analysis Studio share links (Batch 4 phase G).
//   POST   /            (Firebase JWT) share a run: re-fetch + freeze the sources, re-run the checks, refuse on any error, store an unlisted share
//   GET    /?id=<id>    (public) the frozen share, no owner id; `owner:true` only if a valid token of the owner is sent
//   DELETE /?id=<id>    (JWT, owner only) hard delete
//   OPTIONS             CORS preflight
// CORS is emitted in code (Function-URL CORS config stays EMPTY, like newsAnalyze). Every response carries
// `X-Robots-Tag: noindex, nofollow`. No LLM, no secret: the JWT certs are public and the proxy actions are public.
import { randomBytes } from 'node:crypto';
import { corsHeaders, DEFAULT_ORIGINS } from './cors.js';
import { verifyFirebaseToken } from './auth.js';
import { checkPayload, utcDayStart, MAX_BODY_BYTES, DAILY_CAP, LENS_IDS } from './limits.js';
import { freezeSources, makeProxyFetchers, sameNumbering } from './freeze.js';
import { validateAnalysis } from './analysisValidator.js';
import { validateStruct } from './analysisStruct.js';
import { LENSES } from './analysisPrompt.js';

const ID_RE = /^[A-Za-z0-9_-]{22}$/;

function lowerHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) out[k.toLowerCase()] = v;
  return out;
}

// What a reader may see of a stored share (never the owner's uid).
export function publicView(item, owner = false) {
  const { uid: _uid, ...rest } = item; // eslint-disable-line no-unused-vars
  return { ...rest, owner };
}

function validateSection(sec, frozen) {
  const deep = sec.mode === 'deep';
  const struct = sec.struct ? validateStruct(sec.struct, sec.prose) : null;
  const lens = LENSES.find((l) => l.id === sec.lensId);
  const requiresStruct = sec.mode === 'guided' && !deep && Boolean(lens && lens.requiresStruct);
  const checks = deep
    ? validateAnalysis(sec.prose, { citations: frozen.citations, webSources: sec.webSources })
    : validateAnalysis(sec.prose, { citations: frozen.citations, context: frozen.context, thinInput: frozen.thin, webSources: sec.webSources, requiresStruct, structOk: Boolean(struct) });
  return { struct, checks };
}

export async function handleRequest(event, deps) {
  const cfg = deps.config;
  const headers = lowerHeaders(event.headers);
  const origin = headers.origin;
  const method = (event.requestContext && event.requestContext.http && event.requestContext.http.method) || event.httpMethod || 'GET';
  const respond = (status, body, extra = {}) => ({
    statusCode: status,
    headers: {
      ...corsHeaders(origin, cfg.origins),
      'Content-Type': 'application/json',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
      ...extra,
    },
    body: body === undefined ? '' : JSON.stringify(body),
  });

  if (method === 'OPTIONS') return respond(204);

  const id = event.queryStringParameters && event.queryStringParameters.id;
  const authOpts = { projectId: cfg.projectId, getCerts: deps.getCerts, now: deps.now };

  // ---- public read ----
  if (method === 'GET') {
    if (!id || !ID_RE.test(id)) return respond(404, { error: 'not_found' });
    const item = await deps.store.get(id);
    if (!item) return respond(404, { error: 'not_found' });
    let owner = false;
    if (headers.authorization) {
      const who = await verifyFirebaseToken(headers.authorization, authOpts);
      owner = Boolean(who && who.uid === item.uid);
    }
    return respond(200, { share: publicView(item, owner) }, { 'Cache-Control': owner ? 'no-store' : 'private, max-age=60' });
  }

  // ---- everything else needs a signed-in user ----
  const who = await verifyFirebaseToken(headers.authorization, authOpts);
  if (!who) return respond(401, { error: 'sign_in_required' });

  if (method === 'DELETE') {
    if (!id || !ID_RE.test(id)) return respond(404, { error: 'not_found' });
    const item = await deps.store.get(id);
    if (!item) return respond(404, { error: 'not_found' });
    if (item.uid !== who.uid) return respond(403, { error: 'not_owner' });
    await deps.store.deleteOwned(id, who.uid);
    return respond(204);
  }

  if (method !== 'POST') return respond(405, { error: 'method_not_allowed' });

  // ---- POST: share a run ----
  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return respond(413, { error: 'too_large', message: 'The request is too large.' });
  let body;
  try { body = JSON.parse(raw); } catch { return respond(400, { error: 'bad_request', message: 'The request is not valid JSON.' }); }

  const parsed = checkPayload(body);
  if (!parsed.ok) return respond(parsed.status, { error: parsed.code, message: parsed.message });
  const req = parsed.value;

  const nowMs = deps.now();
  const used = await deps.store.countSince(who.uid, utcDayStart(nowMs));
  if (used >= cfg.dailyCap) return respond(429, { error: 'daily_limit', limit: cfg.dailyCap, message: `You've reached today's limit of ${cfg.dailyCap} shared analyses.` });

  const token = headers.authorization.slice(7);
  const fetchers = deps.makeFetchers(token);
  const frozen = await freezeSources({ stories: req.stories, fetchers, onError: deps.log });
  if (!frozen.ok) return respond(frozen.status, { error: frozen.code, message: frozen.message });
  if (!sameNumbering(frozen.frozen.citations, req.citations)) {
    return respond(409, { error: 'sources_changed', message: 'The stories changed since your run, so the sources it cited no longer match. Run it again to share.' });
  }

  const sections = [];
  const failures = [];
  req.sections.forEach((sec, i) => {
    const { struct, checks } = validateSection(sec, frozen.frozen);
    const errors = (checks.warnings || []).filter((w) => w.severity === 'error');
    if (errors.length) { failures.push({ section: i + 1, lens: sec.lensId, reasons: errors.map((e) => e.message) }); return; }
    sections.push({
      lensId: sec.lensId, mode: sec.mode, focus: sec.focus, prose: sec.prose, struct, webSources: sec.webSources,
      checks: { hasError: false, warnings: (checks.warnings || []).map((w) => ({ code: w.code, severity: w.severity, message: String(w.message).slice(0, 400) })) },
    });
  });
  if (failures.length) return respond(422, { error: 'checks_failed', message: 'This analysis failed its checks, so it cannot be shared.', failures });

  const createdAt = new Date(nowMs).toISOString();
  const item = {
    id: deps.newId(), uid: who.uid, schema: 1, createdAt,
    runAt: req.run.runAt || createdAt, sourcesFrozenAt: createdAt,
    stories: frozen.frozen.stories, sources: frozen.frozen.sources, sections,
    run: { provider: req.run.provider, model: req.run.model },
    checkedAt: createdAt,
  };
  item.bytes = Buffer.byteLength(JSON.stringify(item), 'utf8');
  let ok = await deps.store.put(item);
  if (!ok) { item.id = deps.newId(); ok = await deps.store.put(item); }
  if (!ok) return respond(500, { error: 'store_failed' });
  return respond(201, { id: item.id });
}

// ---- real wiring (only built inside Lambda) ----
let realDeps = null;
async function buildRealDeps() {
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const lib = await import('@aws-sdk/lib-dynamodb');
  const { makeStore } = await import('./store.js');
  const client = lib.DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' }), { marshallOptions: { removeUndefinedValues: true } });
  const config = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS,
    dailyCap: Number(process.env.DAILY_SHARE_CAP) || DAILY_CAP,
  };
  const proxyUrl = process.env.PROXY_URL;
  return {
    config,
    now: () => Date.now(),
    newId: () => randomBytes(16).toString('base64url'),
    log: (label, err) => console.warn('share upstream', label, String(err && err.message || err)),
    store: makeStore({ client, table: process.env.SHARES_TABLE, commands: { GetCommand: lib.GetCommand, PutCommand: lib.PutCommand, DeleteCommand: lib.DeleteCommand, QueryCommand: lib.QueryCommand } }),
    makeFetchers: (token) => makeProxyFetchers({ proxyUrl, token }),
  };
}

export const handler = async (event = {}) => {
  if (!realDeps) realDeps = await buildRealDeps();
  try {
    return await handleRequest(event, realDeps);
  } catch (err) {
    console.error('share error', String(err && err.message || err));
    return { statusCode: 500, headers: { ...corsHeaders(lowerHeaders(event.headers).origin, realDeps.config.origins), 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' }, body: JSON.stringify({ error: 'server_error' }) };
  }
};

export { LENS_IDS };
