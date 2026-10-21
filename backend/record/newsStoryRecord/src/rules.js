'use strict';

const {
  normalizeActor
} = require('./_shared/record');
const { day, addDays, verdictOrder } = require('./_shared/world');
const lastStatus = b => b.status.at(-1)?.status || 'hold';
const live = b => ['hold', 'late'].includes(lastStatus(b));
const intersect = (a, b) => [...new Set(a)].filter(x => b.includes(x));
function duplicates(stories, date, asOf = null) {
  const cutoff = asOf && day(asOf) === date ? Date.parse(asOf) : Date.parse(`${addDays(date, 1)}T00:00:00Z`);
  const out = [];
  for (let i = 0; i < stories.length; i++) for (let j = i + 1; j < stories.length; j++) {
    const [a, b] = [stories[i], stories[j]].sort((x, y) => (x.bornAt || x.born).localeCompare(y.bornAt || y.born) || x.threadId.localeCompare(y.threadId));
    const age = cutoff - Date.parse(b.bornAt || `${b.born}T00:00:00Z`);
      if (age < 0 || age > 48 * 3600000) continue;
    const actors = intersect(a.actors.map(normalizeActor), b.actors.map(normalizeActor));
    const places = intersect(a.countries, b.countries);
    const headlines = intersect(a.events.flatMap(e => e.outlets.map(o => `${normalizeActor(o.source)}|${normalizeActor(o.title)}`)), b.events.flatMap(e => e.outlets.map(o => `${normalizeActor(o.source)}|${normalizeActor(o.title)}`))).filter(h => h.split('|').every(Boolean));
    if (actors.length && places.length && headlines.length) out.push({
      from: b.threadId,
      into: a.threadId,
      action: 'proposed only',
      evidence: {
        actors,
        places,
        headlines,
        born: b.born,
        bornAt: b.bornAt || null,
        window: '48h before asOf',
            asOf: new Date(cutoff).toISOString()
      }
    });
  }
  return out;
}
function citations(evidence, entries) {
  return (evidence || []).filter(ref => typeof ref.url==='string' && /^https?:\/\//.test(ref.url) && entries.some(e => e.archive === ref.archive && e.topicId === ref.topicId && e.outlets.some(o => o.url === ref.url)));
}
function namedSourceMatches(source, outlet) {
  const name = normalizeActor(source);
  const host = normalizeActor(outlet).replace(/^www\./, '');
  const aliases = {
    'apnews.com': ['ap', 'associated press'],
    'bbc.co.uk': ['bbc'],
    'bbc.com': ['bbc']
  };
  const candidates = [host, host.replace(/\.(com|org|net)$/, ''), ...(aliases[host] || [])];
  return candidates.filter(x => x.length >= 2 && !['news', 'media', 'reports', 'sources'].includes(x)).some(x => {
    const escaped = x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(name);
  });
}
function outletIdentity(outlet) {
  const host = normalizeActor(outlet).replace(/^www\./, '');
  if (['ap', 'apnews.com', 'associated press'].includes(host)) return 'associated press';
  if (['bbc', 'bbc.com', 'bbc.co.uk'].includes(host)) return 'bbc';
  return host.replace(/\.(com|org|net)$/, '');
}
function transition(branch, result, entries, siblingFired) {
  const evidence = citations(result.evidence, entries);
  const outlets = [...new Set(evidence.flatMap(ref => entries.filter(e => e.archive === ref.archive && e.topicId === ref.topicId).flatMap(e => e.outlets.filter(o => o.url === ref.url).map(o => normalizeActor(o.source)))).filter(Boolean))];
  const named = outlets.some(o => namedSourceMatches(branch.resolutionSource, o));
  if (result.status === 'fired' && (named || new Set(outlets.map(outletIdentity)).size >= 2)) return {
    status: lastStatus(branch) === 'dead' ? 'resurrected' : 'fired',
    evidence,
    note: result.note || ''
  };
  if (result.status === 'dead' && (siblingFired || result.impossible === true && evidence.length)) return {
    status: 'dead',
    evidence,
    note: result.note || ''
  };
  return {
    status: 'hold',
    evidence: [],
    note: 'Trigger not established by admissible evidence'
  };
}
module.exports = {
  day,
  addDays,
  lastStatus,
  live,
  verdictOrder,
  duplicates,
  citations,
  transition,
  namedSourceMatches
};
