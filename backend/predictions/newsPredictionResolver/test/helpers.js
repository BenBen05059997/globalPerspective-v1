'use strict';

// In-memory store with the same interface and the same conditional-put semantics as store.js.
function fakeStore(preds = []) {
  const rows = new Map();
  const key = (PK, SK) => `${PK}\u0000${SK}`;
  const s = {
    rows,
    puts: [],
    async putOnce(item) {
      const k = key(item.PK, item.SK);
      if (rows.has(k)) return false;
      rows.set(k, JSON.parse(JSON.stringify(item)));
      s.puts.push(item.PK + ' ' + item.SK);
      return true;
    },
    async get(PK, SK) { return rows.get(key(PK, SK)) || null; },
    async listCommits() { return [...rows.values()].filter((r) => r.PK.startsWith('SEED#') && r.SK === 'COMMIT'); },
    async predRows(a, b) { return preds.filter((r) => r.SK >= a && r.SK <= b && r.questionSchema); },
    async listQuestionRows() { return [...rows.values()].filter((r) => r.PK.startsWith('Q#')); },
    async queryPK(PK) { return [...rows.values()].filter((r) => r.PK === PK); },
  };
  return s;
}

// A PRED row with N question triggers, all `lead` days out.
function predRow(topic, sk, n, { lead = 30, thread } = {}) {
  const addDays = (d, k) => new Date(Date.parse(d + 'T00:00:00Z') + k * 86400000).toISOString().slice(0, 10);
  return {
    PK: `PRED#${topic}`, SK: sk, topicId: topic, title: `Story ${topic}`, generatedAt: `${sk}T05:00:00.000Z`,
    threadId: thread === undefined ? `thread-${topic}` : thread, questionSchema: 1,
    scenarios: [{
      label: 'Most Likely', probability: 0.6,
      triggers: Array.from({ length: n }, (_, i) => ({
        id: `0-${i}`, qid: `${topic}-${sk}-${i}`, text: `Event ${i} of ${topic} happens`, deadline: addDays(sk, lead + i),
        question: true, p: 55, resolutionSource: 'Reuters or AP wire report',
      })),
    }],
  };
}

module.exports = { fakeStore, predRow };
