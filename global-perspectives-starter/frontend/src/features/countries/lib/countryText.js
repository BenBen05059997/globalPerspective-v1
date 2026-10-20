// countryText — the plain-text version of the country page ("Copy as text"). Pure. The FACT / INFERENCE / MODEL
// JUDGMENT marks are kept, every link becomes a numbered footnote with an absolute address (links.js builders +
// absoluteUrl), and the "What we don't know" block is always included. "Your view" is private and never copied.
import { absoluteUrl, countryHref, storyHref, forecastHref } from '@/shared/lib/links.js';
import { deriveHeadline, tierLabel } from '@/shared/lib/riskTiers.js';

const clean = (s) => String(s || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

/**
 * @param {{country:string, builtOn:string, intel?:object, entries?:object[], totalArticles?:number, dayCount?:number,
 *          change?:object|null, connections?:object[], triggers?:object[], facts?:object[], unknowns:string[]}} m
 */
export function formatCountrySheet(m) {
  const refs = [];
  const ref = (path) => {
    const url = absoluteUrl(path);
    if (!url) return '';
    if (!refs.includes(url)) refs.push(url);
    return `[${refs.indexOf(url) + 1}]`;
  };
  const out = [];
  const section = (title, mark, note) => {
    if (out.length) out.push('');
    out.push(`${title}${mark ? ` [${mark}]` : ''}${note ? ` - ${note}` : ''}`);
  };

  out.push(`GLOBAL PERSPECTIVES - ${m.country} ${ref(countryHref(m.country))}`.trim());
  out.push(`Assembled from our archive on ${m.builtOn}. Marks: FACT = dated reports and outlet links; MODEL JUDGMENT = written by a model, not verified; INFERENCE = worked out from what we hold.`);

  const intel = m.intel;
  const head = intel ? deriveHeadline(intel) : null;
  if (head && head.score != null) {
    section('RISK', 'MODEL JUDGMENT', 'model score, not a measurement');
    out.push(`${tierLabel(head.tier)} ${head.score}${intel.generatedAt ? ` (analysis of ${String(intel.generatedAt).slice(0, 10)})` : ''}`);
    for (const a of head.axes) out.push(`  ${a.label}: ${a.score}${a.why ? ` - ${clean(a.why)}` : ''}`);
  }
  if (intel?.bluf) { section('BOTTOM LINE', 'MODEL JUDGMENT'); out.push(clean(intel.bluf)); }
  if (intel?.whyItMatters) { section('WHY IT MATTERS', 'MODEL JUDGMENT'); out.push(clean(intel.whyItMatters)); }
  if (intel?.riskSignals?.length) {
    section('WHAT TO WATCH', 'MODEL JUDGMENT');
    for (const s of intel.riskSignals.slice(0, 5)) out.push(`- ${clean(s)}`);
  }

  if (m.change) {
    section('WHAT CHANGED', null, m.change.asOf);
    out.push(`[FACT] Trigger headline: ${m.change.eventTitle} ${m.change.threadId ? ref(storyHref(m.change.threadId)) : ''}`.trim());
    out.push(`[MODEL JUDGMENT] Why it changed: ${clean(m.change.why)}`);
  }

  if (m.connections?.length) {
    section('HOW IT CONNECTS', 'MODEL JUDGMENT', 'judged to feed into; not proof of cause');
    for (const c of m.connections) {
      out.push(`- ${c.fromTitle} ${ref(storyHref(c.fromId))} judged to feed into ${c.toTitle} ${ref(storyHref(c.toId))} (${c.confidence || 'unrated'}, ${c.lag})`);
      if (c.mechanism) out.push(`  Mechanism (model): ${clean(c.mechanism)}`);
      for (const h of (c.cited || []).slice(0, 3)) out.push(`  [FACT] ${h.date ? `${h.date} ` : ''}${h.title}`);
    }
  }

  const entries = (m.entries || []).slice(0, 6);
  if (entries.length) {
    section('WHAT HAPPENED', 'FACT', `${m.totalArticles} reports over ${m.dayCount} days; newest ${entries.length} shown`);
    for (const e of entries) {
      const links = [
        ...(e.sources || []).filter((s) => s.url).slice(0, 2).map((s) => `${s.source || 'source'} ${ref(s.url)}`),
        ...(e.threadId ? [`our story ${ref(storyHref(e.threadId))}`] : []),
      ];
      out.push(`- ${e.date}  ${e.title}${links.length ? ` (${links.join('; ')})` : ''}`);
    }
  }

  if (m.triggers?.length) {
    section('FORECASTS', 'MODEL JUDGMENT', 'our forecast, not reported fact');
    for (const t of m.triggers) out.push(`- ${t.label}, by ${t.deadline}${t.qid ? ` ${ref(forecastHref(t.qid))}` : ''}`);
  }

  if (m.facts?.length) {
    section('COUNTRY FACTS', 'FACT');
    for (const f of m.facts) {
      out.push(`- ${f.label}: ${f.value}${f.since ? ` (since ${f.since})` : ''}${f.dataYear ? ` (${f.dataYear})` : ''} - ${f.source}, checked ${String(f.checkedAt).slice(0, 10)}`);
    }
  }

  section("WHAT WE DON'T KNOW", 'INFERENCE');
  for (const l of m.unknowns) out.push(`- ${l}`);

  if (refs.length) {
    out.push('', 'LINKS');
    refs.forEach((u, i) => out.push(`[${i + 1}] ${u}`));
  }
  return out.join('\n');
}
