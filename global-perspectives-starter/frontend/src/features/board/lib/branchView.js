// What a forecast branch shows on the board, read from both record shapes. Live records: `text` is the scenario NAME
// ("Most Likely"), `trigger` is the question, `p` is null and the number is `scenarioP`. Newer records set `p`.
// One reading here so no component picks a field itself. Wording of a branch's status stays in shared/lib/branchWording.js.
const filled = (s) => (typeof s === 'string' && s.trim() ? s.trim() : '');

/** The question / what to watch: the trigger when present, else text. */
export const branchLine = (b) => filled(b?.trigger) || filled(b?.text);

/** The scenario name ("Most Likely"): text, only when a trigger carries the question. Otherwise null. */
export const branchScenario = (b) => (filled(b?.trigger) && filled(b?.text) ? filled(b.text) : null);

/** Our percentage as a whole number: p when finite, else scenarioP when finite, else null. */
export function branchPercent(b) {
  const v = [b?.p, b?.scenarioP].find((x) => typeof x === 'number' && Number.isFinite(x));
  return v === undefined ? null : Math.round(v);
}
