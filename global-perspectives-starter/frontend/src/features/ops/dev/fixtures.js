// Dev and test fixtures for /ops, shaped like the real files (backend/record/schema/health.schema.json and
// backend/monitoring/newsHealth/src/ops.js) and cut from a live dry run of newsHealth on 2026-11-04. Not shipped: loaded only
// behind import.meta.env.DEV (?devOps=1) and by tests.

const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const TODAY = '2026-11-04';
export const DATES = Array.from({ length: 14 }, (_, i) => iso(Date.parse(`${TODAY}T00:00:00Z`) - (13 - i) * DAY));

const STAGES = [
  { id: 'ingest', label: 'Ingest ran' }, { id: 'agent', label: 'Agent wrote the archive' }, { id: 'record', label: 'Record run' },
  { id: 'views', label: 'Views refreshed' }, { id: 'resolver', label: 'Resolver' }, { id: 'situations', label: 'Situations' },
  { id: 'briefs', label: 'Briefs' }, { id: 'errors', label: 'Lambda errors' }, { id: 'compare', label: 'Compare switches' },
];

const row = (stage, status, facts, source, extra = {}) => ({ stage, status, facts, source, at: `${TODAY}T05:20:00.000Z`, error: null, note: null, ...extra });
const SRC = (d) => ({
  ingest: `record/runs/${d}.json inputs.rawDay`, agent: `record/inbox/entries/${d}.jsonl (line count)`, record: `record/runs/${d}.json`,
  views: 'record/views/manifest.json', resolver: 'record/views/health/settle-tick.json + resolver status action', situations: 'world/latest.json',
  briefs: `record/notes/daily_brief/${d}.jsonl`, errors: 'CloudWatch AWS/Lambda Errors (Sum per day, news* functions)',
  compare: 'CloudWatch Logs Insights: DIFFER lines in the step-5d groups, newsAgent, newsEmailSender',
});

function dayRows(d) {
  const s = SRC(d);
  const open = d === TODAY;
  const gap = ['2026-10-22', '2026-10-23', '2026-10-24'].includes(d); // the October outage: the agent wrote nothing
  const noSnapshot = (stage) => row(stage, 'nodata', {}, s[stage], { at: null, note: 'no snapshot was kept for this day' });
  return [
    open ? row('ingest', 'nodata', {}, s.ingest, { note: 'day in progress' }) : row('ingest', 'ok', { rawDay: 'present' }, s.ingest),
    open ? row('agent', 'nodata', { entries: 8, normalRange: [25, 47], thinBelow: 20 }, s.agent, { note: 'day in progress' })
      : gap ? row('agent', 'missing', { entries: 0, normalRange: [25, 47], thinBelow: 20 }, s.agent)
        : row('agent', d === '2026-10-31' ? 'thin' : 'ok', { entries: d === '2026-10-31' ? 17 : 41, normalRange: [25, 47], thinBelow: 20 }, s.agent),
    open ? row('record', 'nodata', {}, s.record, { note: 'day in progress' })
      : gap ? row('record', 'failed', { runStatus: 'failed', failures: ['facts: no archive entries for the day'] }, s.record)
        : row('record', 'ok', { runStatus: 'ok', counts: { entry: 41, story_born: 30, forecast_drawn: 33 }, failures: [] }, s.record),
    row('views', 'ok', { builtAt: `${TODAY}T05:20:12.844Z`, factsThrough: '2026-11-03', provisionalThrough: TODAY }, s.views),
    open ? row('resolver', 'ok', { tickAt: `${TODAY}T10:30:21.400Z`, drafted: 40, settled: 4, errors: 0, due: 11 }, s.resolver) : noSnapshot('resolver'),
    open ? row('situations', 'ok', { generatedAt: `${TODAY}T10:43:59.359Z`, ageHours: 0.3, open: 37, total: 52 }, s.situations) : noSnapshot('situations'),
    open ? row('briefs', 'nodata', { daily: false, weekly: null }, s.briefs, { note: 'day in progress' }) : row('briefs', gap ? 'missing' : 'ok', { daily: !gap, weekly: null }, s.briefs),
    row('errors', d === '2026-10-23' ? 'failed' : d === '2026-11-03' ? 'thin' : 'ok', d === '2026-10-23' ? { total: 37, byFunction: { newsPostLinkedin: 21, newsInvokeGemini: 9 } } : d === '2026-11-03' ? { total: 1, byFunction: { newsGdacsIngest: 1 } } : { total: 0 }, s.errors),
    row('compare', d === '2026-11-03' ? 'thin' : 'ok', d === '2026-11-03' ? { total: 1, byFunction: { newsAgent: 1 } } : { total: 0 }, s.compare),
  ];
}

export function devHealth() {
  return {
    schemaVersion: 1, asOf: new Date(Date.now() - 12 * 60000).toISOString(), producer: 'newsHealth', stages: STAGES,
    days: DATES.map((date) => ({ date, closed: date !== TODAY, rows: dayRows(date) })),
    now: { resolver: { sampled: 88, due: 11, drafted: 214, verdicts: 25, commits: 7, error: null } },
  };
}

const line = (fn, step, model, calls, p, c, h, usdv) => ({ fn, step, model, calls, promptTokens: p, completionTokens: c, cacheHitTokens: h, usd: usdv });
const dsLines = [
  line('newsSituationIngest', 'classify_batch', 'deepseek-flash', 51, 84412, 97849, 13056, 0.0878),
  line('newsIngest', 'topic_selection', 'deepseek-v4-pro', 2, 56698, 18175, 0, 0.0734),
  line('newsAgent', 'forecast', 'deepseek-v4-pro', 25, 29660, 20402, 0, 0.06),
  line('newsSystemsAnalysis', 'systems_web', 'deepseek-v4-pro', 10, 22875, 12578, 0, 0.04),
  line('newsCountryIntelligence', 'country_intel', 'deepseek-v4-pro', 3, 8300, 6400, 0, 0.018),
  line('newsThreadAnalysis', 'thread_analysis', 'deepseek-flash', 70, 226604, 110151, 57472, 0.0938),
  line('newsSelectionShadow', 'jev', 'jev-1.14.0', 30, 0, 0, 0, null),
];
const DS = [0.078, 0.111, 0.113, 0.185, 0.338, 0.246, 0.239, 0.278, 2.38, 0.373, 0.162];
const AWS = [0.75, 0.69, 0.75, 0.72, 0.77, 0.79, 0.76, 0.78, 0.79, 5.26, 0.71, 0.38, 0.37];

const D = (arr) => DATES.map((_, i) => arr[i] ?? 0);
const READERS_CF = (() => {
  const fam = [
    ['map', 'Map', false, D([22, 31, 18, 40, 55, 61, 44, 37, 52, 70, 66, 48, 59, 33])],
    ['stories', 'Stories', false, D([9, 14, 7, 21, 30, 28, 17, 19, 26, 35, 31, 20, 24, 12])],
    ['countries', 'Countries', false, D([3, 5, 2, 8, 9, 11, 6, 4, 10, 12, 9, 7, 8, 5])],
    ['briefings', 'Briefings', false, D([2, 3, 1, 4, 6, 5, 3, 2, 4, 7, 5, 3, 4, 2])],
    ['trackRecord', 'Track record', false, D([1, 0, 2, 1, 3, 2, 1, 0, 2, 3, 1, 2, 1, 1])],
    ['board', 'Board', false, D([0, 0, 1, 0, 2, 1, 0, 0, 1, 2, 1, 0, 1, 0])],
    ['ops', 'Ops', true, D([4, 6, 2, 5, 3, 7, 4, 2, 6, 8, 5, 3, 4, 2])],
    ['other', 'Other', false, D([1, 2, 0, 1, 2, 1, 1, 0, 1, 2, 1, 1, 0, 1])],
  ].map(([id, label, excluded, days]) => ({ id, label, excluded, views: days.reduce((a, b) => a + b, 0), days }));
  const views = fam.filter((f) => !f.excluded).reduce((a, f) => a + f.views, 0);
  return {
    status: 'ok', pulledAt: `${TODAY}T00:15:00.000Z`, siteTag: 'dev-site-tag', from: DATES[0], to: TODAY, days: DATES,
    totals: { views, opsViews: fam.find((f) => f.id === 'ops').views },
    families: fam,
    topStories: [
      { threadId: 'thread-delhi-air-quality-worsens-to-v-9765a5', views: 41, title: "Delhi Air Quality Worsens to 'Very Poor' Ahead of Diwali" },
      { threadId: 'thread-cyberattack-on-french-bank-cre-a62311', views: 29, title: 'Cyberattack on French Bank Credit Mutuel Arkea' },
      { threadId: 'thread-untitled-0001', views: 12, title: null },
    ],
    topCountryPages: [{ country: 'Japan', views: 33 }, { country: 'India', views: 21 }, { country: 'South Korea', views: 9 }],
    visitorCountries: [{ country: 'United States', views: 410 }, { country: 'Japan', views: 160 }, { country: 'United Kingdom', views: 75 }],
    referrers: [{ host: 'news.ycombinator.com', views: 120 }, { host: 'www.linkedin.com', views: 64 }, { host: 'dev.to', views: 18 }],
    directViews: 390,
  };
})();

const READERS_OWN = {
  status: 'ok',
  users: { total: 13, undated: 0, days: DATES.map((date, i) => ({ date, count: i === 12 ? 1 : 0 })) },
  boards: { total: 4 },
  saved: { total: 21, byType: { thread: 14, country: 5, daily: 2 } },
  shares: { total: 3, undated: 0, days: DATES.map((date, i) => ({ date, count: i === 13 ? 1 : 0 })) },
};

const READERS_ATTENTION = (connected) => [
  ['map', 'Map', 0.9012, [['newsSituationIngest', 0.6], ['newsIngest', 0.3012]]],
  ['stories', 'Stories', 0.5234, [['newsThreadAnalysis', 0.3], ['newsSystemsAnalysis', 0.2234]]],
  ['countries', 'Countries', 0.1812, [['newsCountryIntelligence', 0.1812]]],
  ['briefings', 'Briefings', 0.044, [['newsDailyBrief', 0.044]]],
  ['trackRecord', 'Track record', 0.0312, [['newsPredictionResolver', 0.0312]]],
  ['board', 'Board', null, []],
].map(([id, label, usdv, lambdas]) => ({ id, label, views: connected ? READERS_CF.families.find((f) => f.id === id).views : null, usd: usdv, lambdas: lambdas.map(([fn, u]) => ({ fn, usd: u })) }));

const READERS_NOTE = "Cloudflare Web Analytics counts page loads in browsers that run its beacon. It has no user identity, so the counts include our own testing, and there is no way to exclude it in this source. Attention vs effort: a Lambda's DeepSeek spend over the 14 days is split evenly across the features it serves (scripts/functions.json); AWS cost is not included.";

/** The readers section: Cloudflare 'ok' (connected), 'not_connected' or 'error'; the own-table counts are there in every case. */
export function devReaders(cloudflare = 'ok') {
  const cf = cloudflare === 'ok' ? READERS_CF : cloudflare === 'error' ? { status: 'error', error: 'Cloudflare GraphQL HTTP 403' } : { status: 'not_connected' };
  return { asOf: new Date(Date.now() - 12 * 60000).toISOString(), pulledAt: `${TODAY}T00:15:00.000Z`, note: READERS_NOTE, cloudflare: cf, own: READERS_OWN, attention: READERS_ATTENTION(cloudflare === 'ok') };
}

export function devOpsData(cloudflare = 'ok') {
  const dsDates = DATES.slice(3);
  const dsDays = DATES.map((date) => {
    const i = dsDates.indexOf(date);
    if (i < 0) return { date, usd: null, lines: [] };
    const f = DS[i] / 0.373; // every day has the same shape of lines, scaled to that day's total
    return { date, usd: DS[i], lines: dsLines.map((l) => ({ ...l, calls: Math.round(l.calls * f), usd: l.usd == null ? null : Math.round(l.usd * f * 1e4) / 1e4 })) };
  });
  return {
    schemaVersion: 1, asOf: new Date(Date.now() - 12 * 60000).toISOString(), producer: 'newsHealth',
    deepseek: {
      estimate: true, method: 'tokens from the [usage] log lines, priced hour by hour (peak and off-peak) with src/prices.json',
      pricesSource: 'https://api-docs.deepseek.com/quick_start/pricing', pricesFetchedAt: '2026-11-04', error: null,
      yesterday: { date: '2026-11-03', usd: 0.373 }, monthToDate: { month: '2026-11', from: '2026-11-01', days: 4, usd: 3.19 },
      unpriced: ['jev-1.14.0'], days: dsDays,
    },
    aws: {
      source: 'Cost Explorer GetCostAndUsage, UnblendedCost, daily by service', pulledAt: `${TODAY}T00:15:00.000Z`, error: null,
      yesterday: { date: '2026-11-03', usd: 0.37 }, monthToDate: { month: '2026-11', from: '2026-11-01', days: 3, usd: 1.45 },
      days: DATES.slice(0, 13).map((date, i) => ({ date, usd: AWS[i], byService: [{ service: 'Amazon Simple Storage Service', usd: AWS[i] }] })),
    },
    readers: devReaders(cloudflare),
    unitCosts: {
      labels: { entry: 'per story entry', forecast: 'per forecast question', countryNote: 'per country briefing', dailyBrief: 'per daily brief' },
      days: [{ date: '2026-11-03', entry: { usd: 0.0173, count: 47, per: 0.00037 }, forecast: { usd: 0.06, count: 33, per: 0.00182 }, countryNote: { usd: 0.0181, count: 3, per: 0.00602 }, dailyBrief: { usd: 0.004, count: 1, per: 0.004 } }],
      weeklyReview: [{ week: '2026-W45', usd: 2.0981 }],
    },
  };
}

/** What the `ops` action answers in dev: the operator's data, or the 403 of any other account. */
export async function devOpsReply(mode = 'operator') {
  if (mode === 'forbidden') return { status: 403, data: null };
  return { status: 200, data: devOpsData(mode === 'notConnected' ? 'not_connected' : mode === 'cfError' ? 'error' : 'ok') };
}
