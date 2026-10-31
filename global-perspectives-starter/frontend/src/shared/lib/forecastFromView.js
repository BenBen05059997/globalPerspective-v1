// forecastFromView — a story's forecast from the record, in the shape `prediction_snapshot` returns, so ThreadForecast, mostLikelyScenario,
// buildDeadlines and chipFor read it unchanged (decision 0042 step 4; scoring and state come from the shared questionState rules, 0043).
// The forks come from the story view (`stories/<id>.json`, which also lists the story's entries) or from the forecasts view
// (`forecasts/<id>.json`, decision 0052: the same forks in a file of their own). Pure and import-free: a byte-identical copy lives in
// the newsSharedAnalysis Lambda (guarded by scripts/check-shared-sync.mjs). Null when the view cannot answer (the caller then asks the action).

const MAX_TOPICS = 25; // the action reads at most this many topics

// "PRED#<topic>/<day>/<scenario>-<trigger>" -> { topicId, scenario, id }
function parseBranchId(branchId) {
  const m = String(branchId || '').match(/^PRED#(.+)\/\d{4}-\d{2}-\d{2}\/(\d+)-(.+)$/);
  return m ? { topicId: m[1], scenario: Number(m[2]), id: `${m[2]}-${m[3]}` } : null;
}

function trigger(b, id) {
  const base = {
    id,
    text: b.trigger,
    deadline: b.due,
    verdict: null,
    confirmedBy: null,
    citation: null,
  };
  if (b.question === false) return { ...base, question: false };
  if (!(b.question === true && b.qid)) return base;
  // Only a question's own outcome becomes a verdict; the view's void on a pre-method branch is not shown today.
  const state = b.state || null;
  const verdict = state === 'yes' ? 'fired' : state === 'no' ? 'not_fired' : null;
  const ev = b.verdict?.evidence;
  const evidence = ev && typeof ev === 'object' ? ev : null;
  return {
    ...base,
    verdict,
    citation: verdict ? (evidence?.url || evidence?.title || null) : null,
    question: true,
    qid: b.qid,
    p: typeof b.p === 'number' ? b.p : null,
    source: b.resolutionSource || null,
    scoring: b.scoring ?? null,
    state,
    verdictUrl: evidence?.url || null,
    verdictQuote: evidence?.quote || null,
    voidReason: b.verdict?.voidReason || null,
  };
}

/**
 * viewForecast(view, { topicIds }) -> snapshot | null
 * topicIds: the story's topic ids as the page holds them (the action is asked with these, first 25). Like the
 * action, the forecast is the newest one among those topics; a topic's newest fork counts only when it carries
 * question ids. Null when a story view does not know every asked topic (a topic newer than the view).
 */
export function viewForecast(view, { topicIds } = {}) {
  const forks = Array.isArray(view?.forks) ? view.forks : [];
  const asked = [...new Set((topicIds || []).filter(Boolean))].slice(0, MAX_TOPICS);
  if (!asked.length || !forks.length) return null;
  // the story view lists its entries, so a topic it does not know is newer than the view; the forecasts view lists none and answers for the forks it has
  if (Array.isArray(view.entries)) {
    const known = new Set(view.entries.map((e) => e.topicId).filter(Boolean));
    if (asked.some((t) => !known.has(t))) return null;
  }
  const want = new Set(asked);

  // Each topic's newest fork; then the newest of those that carry question ids.
  const newest = new Map();
  for (const f of forks) {
    const topic = parseBranchId(f.branches?.[0]?.branchId)?.topicId;
    if (!topic || !want.has(topic)) continue;
    if (!newest.has(topic) || String(f.drawnAt) > String(newest.get(topic).drawnAt)) newest.set(topic, f);
  }
  let fork = null;
  for (const f of newest.values()) {
    if (!f.branches.some((b) => b.qid)) continue;
    if (!fork || String(f.drawnAt) > String(fork.drawnAt)) fork = f;
  }
  if (!fork) return null;

  const scenarios = new Map();
  let topicId = null;
  for (const b of fork.branches) {
    const p = parseBranchId(b.branchId);
    if (!p) continue;
    topicId = topicId || p.topicId;
    if (!scenarios.has(p.scenario)) {
      scenarios.set(p.scenario, {
        label: b.text,
        probability: typeof b.scenarioP === 'number' ? b.scenarioP / 100 : null,
        triggers: [],
      });
    }
    if (b.due) scenarios.get(p.scenario).triggers.push(trigger(b, p.id));
  }
  const list = [...scenarios.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s).filter((s) => s.triggers.length);
  if (!list.length) return null;
  return {
    topicId,
    threadId: view.threadId || null,
    title: null,
    generatedAt: fork.drawnAt,
    status: 'open',
    scenarios: list,
  };
}

/** The topic ids a view's forks were drawn for, oldest fork first. */
export function topicIdsOfForks(view) {
  const ids = [];
  for (const f of Array.isArray(view?.forks) ? view.forks : []) {
    const t = parseBranchId(f.branches?.[0]?.branchId)?.topicId;
    if (t && !ids.includes(t)) ids.push(t);
  }
  return ids;
}

/** The newest forecast of a whole story (what `prediction_snapshot` gives when asked by thread): viewForecast over every topic the forks were drawn for. */
export function forecastOfThread(view) {
  return viewForecast(view, { topicIds: topicIdsOfForks(view) });
}

/** The newest of several snapshots (null entries ignored); the first of equals. */
export function newestSnapshot(snapshots) {
  let best = null;
  for (const s of snapshots || []) if (s && (!best || String(s.generatedAt) > String(best.generatedAt))) best = s;
  return best;
}
