// forecastPlaces — "every question placed at the country it is about, with counts per place"
// (TRACK_RECORD_AND_STUDIO_RULING.md). The `prediction_track_record` action carries no place/
// region field on a resolved trigger, so this derives a place the only honest way available:
// matching a real country name against the trigger's own stored title/trigger text — the same
// ISO3_NAME table the live map uses (features/map/lib/situationLabels.js), never a second,
// hand-typed list, and never a guess from a city or an implied region. A trigger that names no
// known country is simply not plotted (never a made-up pin — see StoryMode.jsx's shading rule).
import { ISO3_NAME } from '@/features/map/lib/situationLabels.js';
import { itemState } from '@/features/track-record/lib/questionStates.js';

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Longest name first so "DR Congo" is consumed before the shorter "Congo" can double-match it.
const NAME_ENTRIES = Object.entries(ISO3_NAME).sort((a, b) => b[1].length - a[1].length);

/**
 * placesInText — the set of ISO3 codes whose full country name appears (word-boundary,
 * case-insensitive) in `text`. Pure, deterministic, no network/AI.
 */
export function placesInText(text) {
  if (!text) return [];
  let working = ` ${text} `;
  const found = [];
  for (const [iso3, name] of NAME_ENTRIES) {
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i');
    if (re.test(working)) {
      found.push(iso3);
      working = working.replace(re, (m) => ' '.repeat(m.length));
    }
  }
  return found;
}

/**
 * forecastPlaceCounts — per-place counts from a list of board items. An item is either a sampled
 * question ({ title, question|trigger, state }) or an archived pilot item ({ title, trigger,
 * verdict }). Per place: fired / notFired (resolved yes / no), awaiting, pastUnchecked, void, all.
 * `total` stays fired + notFired (resolved only). An item naming more than one country counts once
 * toward each of them (it really is about all of them). NEVER a per-country accuracy score.
 */
export function forecastPlaceCounts(items) {
  const byIso3 = new Map();
  for (const item of items || []) {
    const text = `${item.title || ''} ${item.trigger || item.question || ''}`;
    const places = new Set(placesInText(text));
    const st = itemState(item);
    for (const iso3 of places) {
      const entry = byIso3.get(iso3) || { iso3, name: ISO3_NAME[iso3] || iso3, fired: 0, notFired: 0, awaiting: 0, pastUnchecked: 0, void: 0, all: 0, items: [] };
      if (st === 'yes') entry.fired += 1;
      else if (st === 'no') entry.notFired += 1;
      else if (st === 'awaiting') entry.awaiting += 1;
      else if (st === 'past_deadline_unchecked') entry.pastUnchecked += 1;
      else if (st === 'void') entry.void += 1;
      entry.all += 1;
      entry.items.push(item);
      byIso3.set(iso3, entry);
    }
  }
  return [...byIso3.values()]
    .map((e) => ({ ...e, total: e.fired + e.notFired }))
    .sort((a, b) => b.all - a.all);
}
