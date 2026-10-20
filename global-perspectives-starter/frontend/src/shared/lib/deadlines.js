// deadlines — the dated triggers of a thread's prediction snapshot, shared by threads and countries.
/**
 * buildDeadlines(forecast) -> [{ id, label, deadline, fired, scenarioLabel }] — only real dated
 * triggers from the thread's own v1 prediction snapshot. Empty when there is no forecast, or the
 * forecast carries no dated triggers (never invented).
 */
export function buildDeadlines(forecast) {
  if (!forecast?.scenarios?.length) return [];
  const out = [];
  for (const scenario of forecast.scenarios) {
    for (const trig of scenario.triggers || []) {
      if (!trig.deadline) continue;
      out.push({
        id: trig.id || `${scenario.label}-${trig.deadline}`,
        label: trig.text,
        deadline: trig.deadline,
        verdict: trig.verdict || null,
        scenarioLabel: scenario.label,
        // per-question facts (Batch 4): present only for questions with their own probability
        ...(trig.question === true ? { question: true, qid: trig.qid, p: trig.p, source: trig.source, scoring: trig.scoring, state: trig.state } : {}),
      });
    }
  }
  return out.sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));
}
