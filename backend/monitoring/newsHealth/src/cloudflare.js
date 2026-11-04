'use strict';

// Cloudflare Web Analytics (the RUM beacon already on the site) through the GraphQL analytics API. The only network code of the
// readers panel; `fetchFn` is injected so tests run offline. Facts only: no token -> not_connected, any failure -> error, never a guess.
const { READERS } = require('./config');

const errText = (e) => String((e && e.message) || e).slice(0, 200);

/** The site tag: env CF_SITE_TAG if set, else the Web Analytics site of this account whose host is globalperspective.net. */
async function findSiteTag({ token, accountId, fetchFn, env = process.env }) {
  if (env.CF_SITE_TAG) return env.CF_SITE_TAG;
  const res = await fetchFn(`${READERS.restBase}/accounts/${accountId}/rum/site_info/list?per_page=100`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Cloudflare site list HTTP ${res.status}`);
  const body = await res.json();
  if (body.success === false) throw new Error(`Cloudflare site list: ${errText(((body.errors || [])[0] || {}).message || 'refused')}`);
  const sites = body.result || [];
  // A site's host is on the site itself (`host`) or on its ruleset (`ruleset.zone_name`), depending on how it was added.
  const hit = sites.find((s) => [s.host, s.ruleset && s.ruleset.zone_name, s.zone_name].some((h) => h === READERS.siteHost || h === `www.${READERS.siteHost}`));
  if (!hit || !hit.site_tag) throw new Error(`no Web Analytics site for ${READERS.siteHost} in this account (${sites.length} sites); set CF_SITE_TAG`);
  return hit.site_tag;
}

const FILTER = '{ AND: [{ siteTag: $siteTag }, { datetime_geq: $from, datetime_leq: $to }] }';
const group = (alias, dims) => `${alias}: rumPageloadEventsAdaptiveGroups(filter: ${FILTER}, limit: $limit, orderBy: [count_DESC]) {
        count
        sum { visits }
        dimensions { ${dims} }
      }`;
const QUERY = `query Readers($accountTag: string!, $siteTag: string!, $from: Time!, $to: Time!, $limit: uint64!) {
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
 * -> { siteTag, pages:[{date,path,views,visits}], referrers:[{host,views,visits}], countries:[{country,views,visits}] }.
 * Throws with the API's own message on an HTTP, GraphQL or shape failure.
 */
async function pullCloudflare({ token, days, now, fetchFn = fetch, env = process.env }) {
  const accountId = READERS.accountId;
  const siteTag = await findSiteTag({ token, accountId, fetchFn, env });
  const from = `${days[0]}T00:00:00Z`;
  const to = new Date(now).toISOString().replace(/\.\d+Z$/, 'Z');
  const res = await fetchFn(READERS.graphqlUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { accountTag: accountId, siteTag, from, to, limit: READERS.rowLimit } }),
  });
  if (!res.ok) throw new Error(`Cloudflare GraphQL HTTP ${res.status}`);
  return { siteTag, ...parseGraphql(await res.json()) };
}

module.exports = { pullCloudflare, parseGraphql, findSiteTag, QUERY };
