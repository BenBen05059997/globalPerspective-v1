// Test helpers: real RS256 Firebase-style tokens (signed with a throwaway key; the "cert" handed to the
// verifier is that key's public PEM, which crypto.verify accepts like an x509 cert), and in-memory fakes.
import { generateKeyPairSync, createSign } from 'node:crypto';
import fs from 'node:fs';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const PROJECT = 'test-project';
export const CERTS = { kid1: publicKey.export({ type: 'spki', format: 'pem' }) };
export const getCerts = async () => CERTS;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function makeToken({ uid = 'user-1', aud = PROJECT, iss = `https://securetoken.google.com/${PROJECT}`, exp = 4102444800, kid = 'kid1', alg = 'RS256', signWith = privateKey } = {}) {
  const head = b64({ alg, kid, typ: 'JWT' });
  const body = b64({ user_id: uid, sub: uid, aud, iss, exp });
  const sig = createSign('SHA256').update(`${head}.${body}`).sign(signWith).toString('base64url');
  return `${head}.${body}.${sig}`;
}
export const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

export const golden = JSON.parse(fs.readFileSync(new URL('./fixtures/contextGolden.json', import.meta.url), 'utf8'));

// fetchers that answer from the golden proxy map (same shapes restProxy returns)
export function goldenFetchers(overrides = {}) {
  const p = golden.proxy;
  // today's topics as the proxy serves them (id / title / regions / category / sources / threadId)
  const topics = golden.stories.map((s) => ({ id: s.topicId, threadId: s.threadId, title: s.title, regions: s.regions, category: s.category, sources: s.sources }));
  return {
    topics: async () => ({ data: { topics } }),
    summary: async (id) => p.summary[id], prediction: async (id) => p.prediction[id], traceCause: async (id) => p.trace_cause[id],
    narrativeThread: async (id) => p.narrative_thread[id], threadAnalyses: async (ids) => p.thread_analysis[ids[0]], predictionSnapshot: async () => p.prediction_snapshot.any,
    ...overrides,
  };
}

export function fakeStore() {
  const rows = new Map();
  return {
    rows,
    async put(item) { if (rows.has(item.id)) return false; rows.set(item.id, JSON.parse(JSON.stringify(item))); return true; },
    async get(id) { return rows.get(id) || null; },
    async deleteOwned(id, uid) { const r = rows.get(id); if (!r || r.uid !== uid) return false; rows.delete(id); return true; },
    async countSince(uid, since) { return [...rows.values()].filter((r) => r.uid === uid && r.createdAt >= since).length; },
  };
}

export function makeDeps(over = {}) {
  let n = 0;
  return {
    config: { projectId: PROJECT, origins: ['https://globalperspective.net'], dailyCap: 20 },
    now: () => Date.parse('2026-10-05T12:00:00Z'),
    getCerts,
    newId: () => `id${String(++n).padStart(20, '0')}`,
    log: () => {},
    store: fakeStore(),
    makeFetchers: () => goldenFetchers(),
    ...over,
  };
}

export const event = (method, { token, body, query, origin = 'https://globalperspective.net' } = {}) => ({
  requestContext: { http: { method } },
  headers: { origin, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  queryStringParameters: query,
  body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
});

// a request body for the golden stories with prose that passes every check
export function goodBody(over = {}) {
  return {
    stories: golden.stories.map((s) => ({ topicId: s.topicId, threadId: s.threadId })),
    citations: golden.expected.citations,
    sections: [{
      lensId: 'freeform', mode: 'freeform', focus: 'What happens next?',
      prose: `Bottom line: the US strikes on tankers [1][5] raised risk to high [3], and the forecast log gives a UN condemnation a 60% chance [2]. Japan's stimulus [6] is a separate story [7].\n\n## Limits of this analysis\nThe material is a few snippets.`,
      struct: null, webSources: [],
    }],
    run: { provider: 'deepseek', model: 'deepseek-v4-pro', runAt: '2026-10-05T11:58:00Z' },
    ...over,
  };
}
