const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const wd = require('./facts');

const REGION = process.env.AWS_REGION || 'us-east-1';
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const ACLED_USERNAME = process.env.ACLED_USERNAME || '';
const ACLED_PASSWORD = process.env.ACLED_PASSWORD || '';

let acledAccessToken = null; // cached per-invocation
let acledTokenFailed = false; // do not retry a failed login for every country

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

// Countries to update. The first 12 keep their hard-coded QIDs and ACLED lookup (the original set,
// matches DEFAULT_PAIRS) and are the ONLY ones with leadership (Wikidata head-of-state / government
// statements are stale or wrong for several other countries and leadership feeds the country-briefing
// prompts: Batch 3 / D2 found Australia, Sudan, DR Congo, Taiwan wrong); the rest (Batch 3 / D2) are resolved from their ISO 3166-1 alpha-3 code
// (Wikidata P298) in one query. Names are the display names the site uses (FACTS#<name> key).
const TARGET_COUNTRIES = [
  { name: 'Iran',            wikiQid: 'Q794',  leadership: true, acled: true },
  { name: 'Israel',          wikiQid: 'Q801',  leadership: true, acled: true },
  { name: 'United States',   wikiQid: 'Q30',   leadership: true, acled: true },
  { name: 'China',           wikiQid: 'Q148',  leadership: true, acled: true },
  { name: 'Russia',          wikiQid: 'Q159',  leadership: true, acled: true },
  { name: 'Ukraine',         wikiQid: 'Q212',  leadership: true, acled: true },
  { name: 'India',           wikiQid: 'Q668',  leadership: true, acled: true },
  { name: 'Pakistan',        wikiQid: 'Q843',  leadership: true, acled: true },
  { name: 'Saudi Arabia',    wikiQid: 'Q851',  leadership: true, acled: true },
  { name: 'Lebanon',         wikiQid: 'Q822',  leadership: true, acled: true },
  { name: 'United Kingdom',  wikiQid: 'Q145',  leadership: true, acled: true },
  { name: 'Cuba',            wikiQid: 'Q241',  leadership: true, acled: true },
  { name: 'Brazil', iso3: 'BRA' }, { name: 'Canada', iso3: 'CAN' },
  { name: 'Democratic Republic of the Congo', iso3: 'COD' }, { name: 'France', iso3: 'FRA' },
  { name: 'Germany', iso3: 'DEU' }, { name: 'Indonesia', iso3: 'IDN' }, { name: 'Japan', iso3: 'JPN' },
  { name: 'Mexico', iso3: 'MEX' }, { name: 'Nepal', iso3: 'NPL' }, { name: 'North Korea', iso3: 'PRK' },
  { name: 'Philippines', iso3: 'PHL' }, { name: 'South Africa', iso3: 'ZAF' }, { name: 'South Korea', iso3: 'KOR' },
  { name: 'Spain', iso3: 'ESP' }, { name: 'Turkey', iso3: 'TUR' }, { name: 'United Arab Emirates', iso3: 'ARE' },
  { name: 'Yemen', iso3: 'YEM' }, { name: 'Venezuela', iso3: 'VEN' }, { name: 'Italy', iso3: 'ITA' },
  { name: 'Egypt', iso3: 'EGY' }, { name: 'Syria', iso3: 'SYR' }, { name: 'Iraq', iso3: 'IRQ' },
  { name: 'Afghanistan', iso3: 'AFG' }, { name: 'Sudan', iso3: 'SDN' }, { name: 'Ethiopia', iso3: 'ETH' },
  { name: 'Nigeria', iso3: 'NGA' }, { name: 'Taiwan', iso3: 'TWN' }, { name: 'Australia', iso3: 'AUS' },
];

// Stop starting new countries after this many ms (Lambda timeout is 183 s); the rest are simply
// not updated this run and keep their previous record (the order puts the original 12 first).
const TIME_BUDGET_MS = parseInt(process.env.FACTS_TIME_BUDGET_MS || '150000', 10);

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpsGet(options) {
  return new Promise((resolve, reject) => {
    https.get(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = new URL(res.headers.location);
        return resolve(httpsGet({
          hostname: redirectUrl.hostname,
          path: redirectUrl.pathname + redirectUrl.search,
          headers: options.headers,
        }));
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Wikidata: current head of state + head of government ────────────────────

const SPARQL_QUERY = (qid) => `
SELECT ?role ?officeholder ?startTime WHERE {
  {
    wd:${qid} p:P35 ?stmt.
    ?stmt ps:P35 ?officeholder.
    BIND("head_of_state" AS ?role)
    OPTIONAL { ?stmt pq:P580 ?startTime. }
    OPTIONAL { ?stmt pq:P582 ?endTime. }
    FILTER(!BOUND(?endTime))
  } UNION {
    wd:${qid} p:P6 ?stmt.
    ?stmt ps:P6 ?officeholder.
    BIND("head_of_government" AS ?role)
    OPTIONAL { ?stmt pq:P580 ?startTime. }
    OPTIONAL { ?stmt pq:P582 ?endTime. }
    FILTER(!BOUND(?endTime))
  }
}`;

async function sparql(query) {
  const res = await httpsGet({
    hostname: 'query.wikidata.org',
    path: `/sparql?query=${encodeURIComponent(query)}&format=json`,
    headers: { 'User-Agent': 'GlobalPerspective/1.0 (benlai310@gmail.com)', 'Accept': 'application/sparql-results+json' },
  });
  if (res.status !== 200) throw new Error(`Wikidata ${res.status}`);
  return JSON.parse(res.body).results.bindings;
}

async function resolveEntityLabel(qid) {
  try {
    const res = await httpsGet({
      hostname: 'www.wikidata.org',
      path: `/wiki/Special:EntityData/${qid}.json`,
      headers: { 'User-Agent': 'GlobalPerspective/1.0 (benlai310@gmail.com)' },
    });
    const ent = JSON.parse(res.body).entities[qid];
    return ent.labels?.en?.value || ent.sitelinks?.enwiki?.title || qid;
  } catch {
    return qid;
  }
}

async function fetchWikidataLeadership(qid) {
  const query = SPARQL_QUERY(qid);
  const res = await httpsGet({
    hostname: 'query.wikidata.org',
    path: `/sparql?query=${encodeURIComponent(query)}&format=json`,
    headers: {
      'User-Agent': 'GlobalPerspective/1.0 (benlai310@gmail.com)',
      'Accept': 'application/sparql-results+json',
    },
  });

  const bindings = JSON.parse(res.body).results.bindings;
  const result = {};

  for (const b of bindings) {
    const role = b.role.value;
    const officeholderQid = b.officeholder.value.split('/').pop();
    const label = await resolveEntityLabel(officeholderQid);
    const since = b.startTime?.value?.substring(0, 10) || null;
    result[role] = { name: label, since };
  }

  return result; // { head_of_state: { name, since }, head_of_government: { name, since } }
}

// ─── ACLED: active conflicts for a country ────────────────────────────────────
// OAuth token-based auth. Requires free account at acleddata.com — set
// ACLED_USERNAME (email) + ACLED_PASSWORD env vars.

function httpsPostForm(hostname, path, formData) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(formData).toString();
    const req = https.request({
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'GlobalPerspective/1.0 (benlai310@gmail.com)',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getAcledToken() {
  if (acledAccessToken) return acledAccessToken;
  if (acledTokenFailed || !ACLED_USERNAME || !ACLED_PASSWORD) return null;

  try {
    const res = await httpsPostForm('acleddata.com', '/oauth/token', {
      username: ACLED_USERNAME,
      password: ACLED_PASSWORD,
      grant_type: 'password',
      client_id: 'acled',
    });
    if (res.status !== 200) {
      console.error(`ACLED auth failed: ${res.status} ${res.body.substring(0, 200)}`);
      acledTokenFailed = true;
      return null;
    }
    const data = JSON.parse(res.body);
    acledAccessToken = data.access_token;
    console.log('ACLED token acquired');
    return acledAccessToken;
  } catch (e) {
    console.error('ACLED auth error:', e.message);
    acledTokenFailed = true;
    return null;
  }
}

async function fetchAcledConflicts(countryName) {
  const token = await getAcledToken();
  if (!token) {
    console.log(`ACLED: skipped (no credentials) for ${countryName}`);
    return null;
  }

  const today = new Date();
  const thirtyDaysAgo = new Date(today - 30 * 24 * 60 * 60 * 1000);
  const dateFrom = thirtyDaysAgo.toISOString().substring(0, 10);
  const dateTo = today.toISOString().substring(0, 10);

  const params = new URLSearchParams({
    _format: 'json',
    country: countryName,
    event_date: `${dateFrom}|${dateTo}`,
    event_date_where: 'BETWEEN',
    fields: 'event_date|event_type|sub_event_type|actor1|actor2|location|fatalities|notes',
    limit: 50,
  });

  try {
    const res = await new Promise((resolve, reject) => {
      https.get({
        hostname: 'acleddata.com',
        path: `/api/acled/read?${params.toString()}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'GlobalPerspective/1.0 (benlai310@gmail.com)',
        },
      }, (r) => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => resolve({ status: r.statusCode, body: data }));
      }).on('error', reject);
    });

    if (res.status !== 200) {
      console.error(`ACLED read failed for ${countryName}: ${res.status} — ${res.body.substring(0, 300)}`);
      return null;
    }

    const data = JSON.parse(res.body);
    const events = data.data || [];
    if (!events.length) {
      return { eventCount30d: 0, fatalities30d: 0, source: 'ACLED', retrievedAt: new Date().toISOString() };
    }

    const totalFatalities = events.reduce((s, e) => s + (parseInt(e.fatalities) || 0), 0);
    const latestEvent = events[0];
    const actorPairs = [...new Set(
      events.map(e => `${e.actor1 || '?'}${e.actor2 ? ' vs ' + e.actor2 : ''}`)
    )].slice(0, 3);

    return {
      eventCount30d: events.length,
      fatalities30d: totalFatalities,
      latestEventDate: latestEvent.event_date,
      latestEventSummary: (latestEvent.notes || '').substring(0, 200),
      dominantActors: actorPairs,
      source: 'ACLED',
      retrievedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`ACLED error for ${countryName}:`, e.message);
    return null;
  }
}

// ─── DynamoDB: read current + write updated ───────────────────────────────────

async function readCurrentFacts(countryName) {
  try {
    const res = await ddb.send(new GetCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: `FACTS#${countryName}`, SK: 'COUNTRY_FACTS' },
    }));
    return res.Item || null;
  } catch {
    return null;
  }
}

async function writeFacts(countryName, facts) {
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: {
      PK: `FACTS#${countryName}`,
      SK: 'COUNTRY_FACTS',
      countryName,
      ...facts,
      lastUpdatedAt: new Date().toISOString(),
      ttl,
    },
  }));
}

// ─── Per-country update logic ─────────────────────────────────────────────────

// Capital + population only (no leadership, no ACLED): the D2 countries. A Put replaces the whole
// record, so this never carries leadership fields forward.
async function updateCapPopOnly({ name, wikiQid }, capPop) {
  console.log(`Updating ${name} (capital + population only)...`);
  const existing = await readCurrentFacts(name);
  const nowIso = new Date().toISOString();
  await writeFacts(name, wd.buildCapPop({ qid: wikiQid, capitals: capPop.capitals, populations: capPop.populations, existing, nowIso }));
  return { name, leadershipChanged: false, capital: !!capPop.capitals.get(wikiQid), population: !!capPop.populations.get(wikiQid) };
}

async function updateCountry({ name, wikiQid, acled, leadership: withLeadership }, capPop) {
  if (!withLeadership) return updateCapPopOnly({ name, wikiQid }, capPop);
  console.log(`Updating ${name}...`);

  const [leadershipRes, acledData] = await Promise.all([
    fetchWikidataLeadership(wikiQid),
    acled ? fetchAcledConflicts(name) : Promise.resolve(null),
  ]);

  const existing = await readCurrentFacts(name);

  // Build leadership string for prompt injection
  const hosEntry = leadershipRes.head_of_state;
  const hogEntry = leadershipRes.head_of_government;

  let leadershipString = '';
  if (hosEntry && hogEntry && hosEntry.name === hogEntry.name) {
    leadershipString = `${hosEntry.name} (Head of State and Government, since ${hosEntry.since || '?'})`;
  } else {
    const parts = [];
    if (hosEntry) parts.push(`Head of State: ${hosEntry.name} (since ${hosEntry.since || '?'})`);
    if (hogEntry) parts.push(`Head of Government: ${hogEntry.name} (since ${hogEntry.since || '?'})`);
    leadershipString = parts.join('. ');
  }

  // Detect leadership change vs existing record
  const previousLeadership = existing?.leadershipString || '';
  // A first record for a country (no previous string) is not a "change" (D2 adds ~28 new countries).
  const leadershipChanged = !!previousLeadership && leadershipString !== previousLeadership;
  if (leadershipChanged) {
    console.log(`  Leadership change detected for ${name}: "${previousLeadership}" → "${leadershipString}"`);
  }

  const facts = {
    leadershipString,
    headOfState: hosEntry || null,
    headOfGovernment: hogEntry || null,
    leadershipSource: 'wikidata',
    leadershipChangedAt: leadershipChanged ? new Date().toISOString() : (existing?.leadershipChangedAt || null),
    acledData: acledData || existing?.acledData || null,
    // D2: capital + population, each with source + own as-of (a failed sub-query keeps the old value + its old date)
    ...wd.buildCapPop({ qid: wikiQid, capitals: capPop.capitals, populations: capPop.populations, existing, nowIso: new Date().toISOString() }),
  };

  await writeFacts(name, facts);
  console.log(`  ${name}: ${leadershipString}${acledData ? ` | ACLED: ${acledData.eventCount30d} events` : ' | ACLED: skipped'}`);
  return { name, leadershipChanged, capital: !!capPop.capitals.get(wikiQid), population: !!capPop.populations.get(wikiQid) };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// Resolve QIDs for the countries that only have an ISO3, then fetch capitals + populations for ALL
// of them in two batched queries. A failed batch returns empty maps: every country then keeps the
// capital / population it already had (buildCapPop) rather than losing it.
async function loadCapPop(countries) {
  const need = countries.filter((c) => !c.wikiQid && c.iso3);
  if (need.length) {
    try {
      const m = wd.parseQidByIso3(await sparql(wd.QID_BY_ISO3_QUERY(need.map((c) => c.iso3))));
      for (const c of need) c.wikiQid = m.get(c.iso3) || null;
    } catch (e) { console.error('QID lookup failed:', e.message); }
  }
  const qids = [...new Set(countries.map((c) => c.wikiQid).filter(Boolean))];
  const capitals = new Map(); const populations = new Map();
  for (let i = 0; i < qids.length; i += 25) {
    const chunk = qids.slice(i, i + 25);
    try { for (const [k, v] of wd.parseCapitals(await sparql(wd.CAPITALS_QUERY(chunk)))) capitals.set(k, v); }
    catch (e) { console.error('capital query failed:', e.message); }
    await sleep(600);
    try { for (const [k, v] of wd.parsePopulations(await sparql(wd.POPULATIONS_QUERY(chunk)))) populations.set(k, v); }
    catch (e) { console.error('population query failed:', e.message); }
    await sleep(600);
  }
  return { capitals, populations };
}

exports.handler = async (event) => {
  console.log('newsCountryFactsUpdater started', JSON.stringify(event));

  if (!SUMMARY_TABLE) {
    throw new Error('Missing SUMMARIZE_PREDICT_TABLE env var');
  }

  const started = Date.now();
  const countries = (event?.countries
    ? TARGET_COUNTRIES.filter(c => event.countries.includes(c.name))
    : TARGET_COUNTRIES).map((c) => ({ ...c }));

  const capPop = await loadCapPop(countries);
  const results = { updated: [], failed: [], skipped: [], leadershipChanges: [], noCapital: [], noPopulation: [] };

  for (const country of countries) {
    if (Date.now() - started > TIME_BUDGET_MS) { results.skipped.push(country.name); continue; }
    if (!country.wikiQid) { console.error(`No Wikidata QID for ${country.name}`); results.failed.push(country.name); continue; }
    try {
      const { name, leadershipChanged, capital, population } = await updateCountry(country, capPop);
      results.updated.push(name);
      if (leadershipChanged) results.leadershipChanges.push(name);
      if (!capital) results.noCapital.push(name);
      if (!population) results.noPopulation.push(name);
      await sleep(600); // stay under Wikidata rate limit
    } catch (e) {
      console.error(`Failed to update ${country.name}:`, e.message);
      results.failed.push(country.name);
    }
  }

  console.log(`newsCountryFactsUpdater complete: ${results.updated.length} updated, ${results.failed.length} failed, ${results.skipped.length} skipped (time budget), ${Date.now() - started} ms`);
  if (results.leadershipChanges.length) {
    console.log(`Leadership changes detected: ${results.leadershipChanges.join(', ')}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(results),
  };
};
