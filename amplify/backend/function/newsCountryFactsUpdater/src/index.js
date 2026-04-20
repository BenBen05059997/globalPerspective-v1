const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const ACLED_USERNAME = process.env.ACLED_USERNAME || '';
const ACLED_PASSWORD = process.env.ACLED_PASSWORD || '';

let acledAccessToken = null; // cached per-invocation

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

// Countries to update — matches DEFAULT_PAIRS union of names
const TARGET_COUNTRIES = [
  { name: 'Iran',            wikiQid: 'Q794'  },
  { name: 'Israel',          wikiQid: 'Q801'  },
  { name: 'United States',   wikiQid: 'Q30'   },
  { name: 'China',           wikiQid: 'Q148'  },
  { name: 'Russia',          wikiQid: 'Q159'  },
  { name: 'Ukraine',         wikiQid: 'Q212'  },
  { name: 'India',           wikiQid: 'Q668'  },
  { name: 'Pakistan',        wikiQid: 'Q843'  },
  { name: 'Saudi Arabia',    wikiQid: 'Q851'  },
  { name: 'Lebanon',         wikiQid: 'Q822'  },
  { name: 'United Kingdom',  wikiQid: 'Q145'  },
  { name: 'Cuba',            wikiQid: 'Q241'  },
];

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
  if (!ACLED_USERNAME || !ACLED_PASSWORD) return null;

  try {
    const res = await httpsPostForm('acleddata.com', '/oauth/token', {
      username: ACLED_USERNAME,
      password: ACLED_PASSWORD,
      grant_type: 'password',
      client_id: 'acled',
    });
    if (res.status !== 200) {
      console.error(`ACLED auth failed: ${res.status} ${res.body.substring(0, 200)}`);
      return null;
    }
    const data = JSON.parse(res.body);
    acledAccessToken = data.access_token;
    console.log('ACLED token acquired');
    return acledAccessToken;
  } catch (e) {
    console.error('ACLED auth error:', e.message);
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

async function updateCountry({ name, wikiQid }) {
  console.log(`Updating ${name}...`);

  const [leadership, acledData] = await Promise.all([
    fetchWikidataLeadership(wikiQid),
    fetchAcledConflicts(name),
  ]);

  const existing = await readCurrentFacts(name);

  // Build leadership string for prompt injection
  const hosEntry = leadership.head_of_state;
  const hogEntry = leadership.head_of_government;

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
  const leadershipChanged = leadershipString !== previousLeadership;
  if (leadershipChanged && previousLeadership) {
    console.log(`  Leadership change detected for ${name}: "${previousLeadership}" → "${leadershipString}"`);
  }

  const facts = {
    leadershipString,
    headOfState: hosEntry || null,
    headOfGovernment: hogEntry || null,
    leadershipSource: 'wikidata',
    leadershipChangedAt: leadershipChanged ? new Date().toISOString() : (existing?.leadershipChangedAt || null),
    acledData: acledData || existing?.acledData || null,
  };

  await writeFacts(name, facts);
  console.log(`  ${name}: ${leadershipString}${acledData ? ` | ACLED: ${acledData.eventCount30d} events` : ' | ACLED: skipped'}`);
  return { name, leadershipChanged };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  console.log('newsCountryFactsUpdater started', JSON.stringify(event));

  if (!SUMMARY_TABLE) {
    throw new Error('Missing SUMMARIZE_PREDICT_TABLE env var');
  }

  const countries = event?.countries
    ? TARGET_COUNTRIES.filter(c => event.countries.includes(c.name))
    : TARGET_COUNTRIES;

  const results = { updated: [], failed: [], leadershipChanges: [] };

  for (const country of countries) {
    try {
      const { name, leadershipChanged } = await updateCountry(country);
      results.updated.push(name);
      if (leadershipChanged) results.leadershipChanges.push(name);
      await sleep(600); // stay under Wikidata rate limit
    } catch (e) {
      console.error(`Failed to update ${country.name}:`, e.message);
      results.failed.push(country.name);
    }
  }

  console.log(`newsCountryFactsUpdater complete: ${results.updated.length} updated, ${results.failed.length} failed`);
  if (results.leadershipChanges.length) {
    console.log(`Leadership changes detected: ${results.leadershipChanges.join(', ')}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(results),
  };
};
