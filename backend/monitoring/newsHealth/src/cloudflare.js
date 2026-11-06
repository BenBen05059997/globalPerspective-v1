'use strict';

// Cloudflare Web Analytics (the RUM beacon already on the site) through the GraphQL analytics API. The only network code of the
// readers panel; `fetchFn` is injected so tests run offline. Facts only: no token -> not_connected, any failure -> error, never a guess.
const { READERS } = require('./config');

const errText = (e) => String((e && e.message) || e).slice(0, 200);

const FILTER = '{ AND: [{ requestHost: $host }, { datetime_geq: $from, datetime_leq: $to }] }';
const group = (alias, dims) => `${alias}: rumPageloadEventsAdaptiveGroups(filter: ${FILTER}, limit: $limit, orderBy: [count_DESC]) {
        count
        sum { visits }
        dimensions { ${dims} }
      }`;
const QUERY = `query Readers($accountTag: string!, $host: string!, $from: Time!, $to: Time!, $limit: uint64!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      ${group('pages', 'date requestPath')}
      ${group('referrers', 'refererHost')}
      ${group('countries', 'countryName')}
    }
  }
}`;

const n = (v) => Number(v) || 0;

/** The GraphQL response body -> rows. An `errors` array, or no account in the answer, is an error (an empty group list is a real zero). */
function parseGraphql(body) {
  if (body && Array.isArray(body.errors) && body.errors.length) throw new Error(`Cloudflare GraphQL: ${errText(body.errors[0].message)}`);
  const acct = body && body.data && body.data.viewer && body.data.viewer.accounts && body.data.viewer.accounts[0];
  if (!acct) throw new Error('Cloudflare GraphQL: no account in the answer (token without access to this account?)');
  return {
    pages: (acct.pages || []).map((g) => ({ date: g.dimensions.date, path: g.dimensions.requestPath, views: n(g.count), visits: n(g.sum && g.sum.visits) })),
    referrers: (acct.referrers || []).map((g) => ({ host: g.dimensions.refererHost || '', views: n(g.count), visits: n(g.sum && g.sum.visits) })),
    countries: (acct.countries || []).map((g) => ({ country: g.dimensions.countryName || '', views: n(g.count), visits: n(g.sum && g.sum.visits) })),
  };
}

/**
 * -> { pages:[{date,path,views,visits}], referrers:[{host,views,visits}], countries:[{country,views,visits}] }.
 * Throws with the API's own message on an HTTP, GraphQL or shape failure.
 */
async function pullCloudflare({ token, days, now, fetchFn = fetch }) {
  const from = `${days[0]}T00:00:00Z`;
  const to = new Date(now).toISOString().replace(/\.\d+Z$/, 'Z');
  const res = await fetchFn(READERS.graphqlUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { accountTag: READERS.accountId, host: READERS.siteHost, from, to, limit: READERS.rowLimit } }),
  });
  if (!res.ok) throw new Error(`Cloudflare GraphQL HTTP ${res.status}`);
  return parseGraphql(await res.json());
}

module.exports = { pullCloudflare, parseGraphql, QUERY };
