// graphText — the words on the graph's pin cards and string labels, from the pin, its info and the string. Pure.
// Nothing is worded that the data does not hold: no topic, no "new this week", no earlier score -> that part is absent.
import { crisisDotVar, crisisTypeForCategory, CRISIS_LABEL } from '@/shared/lib/crisisHue';
import { KIND_WORD } from '@/features/board/lib/boardOps.js';
import { tierFromScore, tierLabel } from '@/shared/lib/riskTiers.js';

const DAY = 86400000;
const STRENGTH_WORD = { weak: 'Weak', medium: 'Medium', strong: 'Strong' };

/** The small type line of a pin card: { text, dot }. A story born in the last seven days reads "New this week";
 *  otherwise the crisis type (when the topic maps to one) and the kind. `dot` is the crisis hue, or undefined. */
export function pinTypeLine(pin, info, now = new Date()) {
  const born = pin.kind === 'thread' && typeof pin.born === 'string' ? Date.parse(pin.born) : NaN;
  const fresh = Number.isFinite(born) && now.getTime() - born >= 0 && now.getTime() - born < 7 * DAY;
  const type = pin.kind === 'thread' ? crisisTypeForCategory(info?.category) : 'neutral';
  const dot = type === 'neutral' ? undefined : crisisDotVar(info.category);
  if (fresh) return { text: 'New this week', dot };
  return { text: [type === 'neutral' ? null : CRISIS_LABEL[type], KIND_WORD[pin.kind]].filter(Boolean).join(' · '), dot };
}

/** The small line under a pin's name on the map: "HIGH 88 · conflict", "HIGH 85 · was 95", "ELEVATED 60 · new".
 *  Each part is absent when the data does not hold it: no risk -> no tier or number; no earlier score, not born this
 *  week and no crisis type -> nothing after the number. */
export function mapPinLine(pin, info, now = new Date()) {
  const risk = info?.risk != null ? `${tierLabel(tierFromScore(info.risk))} ${Math.round(info.risk)}` : null;
  const born = pin.kind === 'thread' && typeof pin.born === 'string' ? Date.parse(pin.born) : NaN;
  const fresh = Number.isFinite(born) && now.getTime() - born >= 0 && now.getTime() - born < 7 * DAY;
  const type = pin.kind === 'thread' ? crisisTypeForCategory(info?.category) : 'neutral';
  const tail = info?.riskWas != null ? `was ${Math.round(info.riskWas)}` : fresh ? 'new' : type !== 'neutral' ? CRISIS_LABEL[type].toLowerCase() : null;
  return [risk, tail].filter(Boolean).join(' · ');
}

/** "5 chapters","2 live branches", "1 confirmed links": the counts the pin carries. [] when none. */
export function pinCountParts(pin) {
  if (!pin.recordAvailable) return [];
  const count = (key, label) => (Number.isInteger(pin.counts?.[key]) && pin.counts[key] >= 0 ? `${pin.counts[key]} ${label}` : null);
  return [count('chapters', 'chapters'), count('liveBranches', 'live branches'), count('confirmedLinks', 'confirmed links')].filter(Boolean);
}

/** The label on a string: { head, body }. Ours: "Ours · Medium" (the strength when it has one, else "Inferred"), plus
 *  "Not confirmed" when the string says so; yours: "Yours" and the reader's line in quotes. */
export function stringLabel(s) {
  if (s.owner === 'yours') {
    return { head: s.cutAt ? 'Yours · Cut' : 'Yours', body: s.line ? `“${s.line}”` : '' };
  }
  const head = ['Ours', STRENGTH_WORD[s.strength] || 'Inferred', s.cutAt ? 'Cut' : null, s.confirmed === false ? 'Not confirmed' : null].filter(Boolean);
  return { head: head.join(' · '), body: s.mechanism || '' };
}

/** The short tag of a string label: its first two parts ("Ours · Medium · Not confirmed" -> "Ours · Medium"). */
export const shortHead = (head) => head.split(' · ').slice(0, 2).join(' · ');
