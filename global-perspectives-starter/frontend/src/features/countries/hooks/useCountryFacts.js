import { useState, useEffect } from 'react';
import { fetchCountryFacts } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink';

// Stored country facts for one country (Batch 3 / D). Module-level cache + in-flight de-dupe (30 min):
// the card mounts on /map and /weekly/country/:name and must not refetch on every selection.
// A failure is reported and leaves `facts` null (no placeholder, no guess).
const TTL_MS = 30 * 60 * 1000;
const cache = new Map();     // name -> { facts, ts }
const inFlight = new Map();  // name -> Promise<facts|null>

function load(name) {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.ts < TTL_MS) return Promise.resolve(hit.facts);
  if (inFlight.has(name)) return inFlight.get(name);
  const p = fetchCountryFacts([name])
    .then((res) => {
      const facts = (res && res.data && res.data[name]) || null;
      cache.set(name, { facts, ts: Date.now() });
      return facts;
    })
    .finally(() => { inFlight.delete(name); });
  inFlight.set(name, p);
  return p;
}

export function useCountryFacts(name) {
  const [state, setState] = useState({ name: null, facts: null });
  useEffect(() => {
    if (!name) return undefined;
    let cancelled = false;
    load(name)
      .then((facts) => { if (!cancelled) setState({ name, facts }); })
      .catch((err) => { reportFetchError('country-facts', err); if (!cancelled) setState({ name, facts: null }); });
    return () => { cancelled = true; };
  }, [name]);
  // never show a previous country's facts under a new name while the new fetch is in flight
  return { facts: state.name === name ? state.facts : null };
}

export function _resetCountryFactsCache() { cache.clear(); inFlight.clear(); }
