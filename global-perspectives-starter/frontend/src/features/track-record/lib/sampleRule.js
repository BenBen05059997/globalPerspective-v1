// sampleRule — the weekly draw rule, so a reader can verify a published draw in the browser.
// It mirrors amplify/backend/function/newsPredictionResolver/src/lib.js (`rankKey`, `draw`):
//   h = sha256(seedHex + '|' + qid); keep only the lowest h per story; sort by h; take the first K.
// The Lambda uses Node's synchronous crypto; this uses WebCrypto (async). Parity is enforced by one
// golden fixture that both sides test against (sampleRuleGolden.json, byte-identical in both
// places; guarded by scripts/check-shared-sync.mjs).

const enc = new TextEncoder();

export async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// pool: [{ q: qid, c: clusterKey }]
export async function drawFromPool(seedHex, pool, K = 22) {
  const best = new Map();
  for (const { q, c } of pool) {
    const h = await sha256Hex(`${seedHex}|${q}`);
    const cur = best.get(c);
    if (!cur || h < cur.h || (h === cur.h && q < cur.qid)) best.set(c, { qid: q, h, clusterKey: c });
  }
  const reps = [...best.values()].sort((x, y) => (x.h < y.h ? -1 : x.h > y.h ? 1 : x.qid < y.qid ? -1 : 1));
  return { picked: reps.slice(0, K), eligible: pool.length, clusters: best.size };
}

/**
 * @param {{weekId:string, weekStart:string, commit:{hash:string,committedAt:string}|null,
 *          reveal:{seedHex:string}|null, draw:{K:number,pool:Array,picked:Array}|null}} week  a `questions.weeks[]` entry
 * @returns {{ok:boolean, problems:string[], picked?:number, eligible?:number, clusters?:number}}
 */
export async function verifyDraw(week) {
  const problems = [];
  if (!week?.commit) problems.push('no commitment was published');
  if (!week?.reveal) problems.push('the seed has not been revealed yet');
  if (!week?.draw) problems.push('the draw (with its list of eligible questions) is not published for this week');
  if (problems.length) return { ok: false, problems };
  if ((await sha256Hex(week.reveal.seedHex)) !== week.commit.hash) problems.push('the revealed seed does not hash to the commitment');
  if (String(week.commit.committedAt).slice(0, 10) >= week.weekStart) problems.push('the commitment was not published before the week started');
  const again = await drawFromPool(week.reveal.seedHex, week.draw.pool, week.draw.K);
  if (JSON.stringify(again.picked) !== JSON.stringify(week.draw.picked)) problems.push('the published picks differ from the recomputed picks');
  return { ok: problems.length === 0, problems, picked: again.picked.length, eligible: again.eligible, clusters: again.clusters };
}
