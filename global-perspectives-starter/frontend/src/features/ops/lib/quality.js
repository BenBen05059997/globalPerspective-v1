// Reading the `quality` section of ops.json (written daily by newsHealth, backend/monitoring/newsHealth/src/quality.js).
// Turns each check into display parts. Nothing is invented: a check that has no source says why, one that failed says the error.
import { dayParts } from '@/features/ops/lib/pipeline.js';
import { count } from '@/features/ops/lib/readers.js';

const n = (v) => count(v) ?? '0';
const plural = (k, one, many) => `${n(k)} ${k === 1 ? one : many}`;
const day = (d) => dayParts(d).long;
const utcMinute = (iso) => (iso ? `${String(iso).slice(0, 16).replace('T', ' ')} UTC` : null);
const pairs = (obj) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${n(v)}`).join(' · ');

function base(id, label, p) {
  if (!p) return { id, label, state: 'missing', headline: null, why: null, source: null, when: null, facts: [], table: null };
  return {
    id, label, state: p.status === 'ok' ? 'ok' : p.status === 'error' ? 'error' : 'not_available',
    why: p.status === 'not_available' ? p.why : p.status === 'error' ? p.error : null,
    source: p.source || null, when: p.day ? day(p.day) : null, headline: null, facts: [], table: null,
  };
}

function duplicates(p) {
  const r = base('duplicates', 'Duplicate open situations', p);
  if (r.state !== 'ok') return r;
  r.when = `as of ${utcMinute(p.at) || 'the build'}`;
  r.headline = p.groups
    ? `${plural(p.groups, 'group', 'groups')} (${plural(p.situations, 'situation', 'situations')}) share a title and countries, among ${n(p.open)} open`
    : `None among ${n(p.open)} open situations`;
  if (p.examples?.length) r.table = { caption: 'Duplicate groups', head: ['Title', 'Countries', 'Situations'], rows: p.examples.map((e) => [e.title, e.countries.join(' '), n(e.ids.length)]) };
  return r;
}

function merged(p) {
  const r = base('merged', 'Situations merged', p);
  if (r.state !== 'ok') return r;
  r.headline = `${plural(p.merged, 'merge', 'merges')} on ${day(p.day)}`;
  if (p.merged) r.facts.push(['By rule', pairs(p.byRule)]);
  r.facts.push(['Sweeps with merges', n(p.files)]);
  if (p.unreadable) r.facts.push(['Files not readable', n(p.unreadable)]);
  return r;
}

function selfReference(p) {
  const r = base('selfReference', 'Summaries that describe their sources', p);
  if (r.state !== 'ok') return r;
  r.headline = `${n(p.matched)} of ${n(p.withSummary)} summaries refer to their snippets, sources or headline`;
  if (p.matched) r.facts.push(['Phrases', pairs(p.byPhrase)]);
  if (p.unparsed) r.facts.push(['Lines not parsed', n(p.unparsed)]);
  if (p.examples?.length) r.table = { caption: `Examples (${p.examples.length} of ${n(p.matched)})`, head: ['Story', 'Phrase'], rows: p.examples.map((e) => [e.title, e.phrase]) };
  return r;
}

function pins(p) { return base('pins', 'Pins outside their country', p); }

function voids(p) {
  const r = base('voids', 'Forecast voids by reason', p);
  if (r.state !== 'ok') return r;
  if (p.fileAbsent) { r.headline = `No verdict file for ${day(p.day)}: nothing was settled that day`; return r; }
  r.headline = `${n(p.voids)} of ${n(p.settled)} forecasts settled void on ${day(p.day)}`;
  if (p.byReason?.length) r.table = { caption: 'Void reasons (record gap first)', head: ['Reason', 'Forecasts'], rows: p.byReason.map((x) => [x.reason, n(x.count)]) };
  if (p.recordGapDays?.length) r.facts.push(['Record gap days named', p.recordGapDays.map(day).join(', ')]);
  if (p.corrections) r.facts.push(['Operator corrections', n(p.corrections)]);
  return r;
}

function coverage(p) {
  const r = base('coverage', 'Coverage gaps per day', p);
  if (r.state !== 'ok') return r;
  r.when = `${day(p.from)} to ${day(p.to)}`;
  r.headline = p.gaps.length ? `${plural(p.gaps.length, 'day', 'days')} of ${n(p.days)} cannot support a "no" verdict` : `No gaps in ${n(p.days)} days`;
  if (p.gaps.length) r.table = { caption: 'Days with a gap', head: ['Day', 'Why'], rows: p.gaps.map((g) => [day(g.day), g.why]) };
  return r;
}

function audit(p) {
  const r = base('audit', 'Summary drift against source articles', p);
  const dead = base('dead', 'Dead outlets', p?.deadOutlets);
  const parts = p?.deadOutlets ? [r, dead] : [r];
  if (r.state !== 'ok') return parts;
  r.headline = `Last run ${day(p.day)}: ${n(p.drift)} drifted, ${n(p.auditErrors)} errors, ${n(p.singleSource)} single-source, of ${n(p.checked)} checked`;
  if (p.drifted?.length) r.table = { caption: 'Summaries that drifted from their sources', head: ['Story (as logged)', 'Sources'], rows: p.drifted.map((d) => [d.title, d.robustness]) };
  return parts;
}

function clientErrors(p) {
  const r = base('clientErrors', 'Client errors by page', p);
  if (r.state !== 'ok') return r;
  r.headline = `${n(p.total)} errors on ${day(p.day)}; median ${n(p.median)} a day over ${day(p.baselineFrom)} to ${day(p.baselineTo)}`;
  if (p.pages?.length) r.table = { caption: 'Errors per page family', head: ['Page', 'Day', 'Median'], rows: p.pages.map((x) => [x.label, n(x.day), n(x.median)]) };
  if (p.pagesOmitted) r.facts.push(['Further pages not shown', n(p.pagesOmitted)]);
  if (p.note) r.facts.push(['How to read', p.note]);
  return r;
}

/** The six checks in order: [{ id, title, parts:[part] }]. A check missing from an older file is one part in state 'missing'. */
export function qualityItems(q) {
  const c = q?.checks || {};
  return [
    { id: 'situations', title: 'Situations', parts: [duplicates(c.situations?.duplicates), merged(c.situations?.merged)] },
    { id: 'selfReference', title: 'Summary wording', parts: [selfReference(c.selfReference)] },
    { id: 'pins', title: 'Pins', parts: [pins(c.pins)] },
    { id: 'forecast', title: 'Forecasts', parts: [voids(c.forecast?.voids), coverage(c.forecast?.coverage)] },
    { id: 'sourceAudit', title: 'Source audit', parts: audit(c.sourceAudit) },
    { id: 'clientErrors', title: 'Client errors', parts: [clientErrors(c.clientErrors)] },
  ];
}
