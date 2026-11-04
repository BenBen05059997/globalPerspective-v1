'use strict';

// newsHealth settings in one place. Every threshold names the measurement it rests on.

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';

const KEYS = {
  health: 'record/views/health.json',   // public: the pipeline panel only
  ops: 'monitoring/ops.json',           // private: money (never under record/views, the Worker serves only that)
  manifest: 'record/views/manifest.json',
  heartbeat: 'record/views/health/settle-tick.json',
  world: 'world/latest.json',
  storyIndex: 'record/views/index/all.json', // thread id -> title for the readers panel
};

const CONFIG = {
  days: 14,                    // UTC days in health.json (the last 14 including today)
  retainOpsDays: 62,           // ops.json keeps older money days so "month to date" survives the 14-day query window
  closeAfterUtcHour: 1,        // a day D is judged only after D+1 01:00 UTC: the record run for D finishes ~23:46 UTC on D
  // Agent archive size, measured 2026-11-04 from record/inbox/entries/DAY.jsonl: 25 to 47 lines a day while healthy
  // (11-03: 47, equal to counts.entry of that day's run). The 21-24 Oct outage wrote 0. Under `thin` is a short day.
  entries: { thin: 20, normalLow: 25, normalHigh: 47 },
  // The views are rebuilt every few hours (viewsFresh.js: stale after 9 h without a build).
  viewsStaleHours: 9,
  // world/latest.json is rewritten every 30 minutes (next_expected_at = generated_at + 30 min).
  situations: { thinAfterHours: 2, failedAfterHours: 6 },
  // The resolver ticks once a night and writes record/views/health/settle-tick.json; 'thin' = it had work due and settled nothing.
  resolver: { functionName: 'newsPredictionResolver' },
  // CloudWatch Errors per day over news* functions, measured 2026-11-04: 1 to 3 a day in the last week (a transient gdacs or
  // linkedin call), 13 to 37 a day during 22-29 Oct. One or more is shown as thin, five or more as failed (the hover names the functions).
  errors: { thinAt: 1, failedAt: 5 },
  // A DIFFER line from a compare switch means that night was not clean (decision 0035: three clean nights before a switch): thin.
  compare: { thinAt: 1, failedAt: Infinity },
  // Lambdas whose [archive-compare] / [notes-compare] / [forks-compare] DIFFER lines are counted (decision 0035 step 5d).
  compareFunctions: ['newsThreadAnalysis', 'newsSystemsAnalysis', 'newsCountryIntelligence', 'newsDriftCorrector', 'newsWeeklyBrief', 'newsAgent', 'newsEmailSender'],
  logGroupPrefix: '/aws/lambda/news',
  metricPrefix: 'news',
  queryMaxWaitMs: 60000,
  queryPollMs: 1000,
  // Money: which usage lines make which unit cost. `count` names a per-day fact (see unitCosts in ops.js).
  units: {
    entry: { label: 'per story entry', fn: ['newsAgent'], steps: ['summary', 'trace_cause'], count: 'entry' },
    forecast: { label: 'per forecast question', fn: ['newsAgent'], steps: ['forecast'], count: 'forecast_drawn' },
    countryNote: { label: 'per country briefing', fn: ['newsCountryIntelligence'], steps: null, count: 'country_notes' },
    dailyBrief: { label: 'per daily brief', fn: null, steps: ['daily_brief'], count: 'daily_brief' },
  },
  weeklyReview: { fn: ['newsRecordReview'] },
};

// Readers (ARCHITECTURE_OPS.md phase 2). Cloudflare Web Analytics through the GraphQL analytics API, once per UTC day.
// The account id is not a secret (it is also in scripts/site-release.config.json). The token is: env CF_ANALYTICS_TOKEN, set by the
// operator (README). CF_SITE_TAG is optional: with the token the site is found by host in the account's Web Analytics sites.
const READERS = {
  accountId: process.env.CF_ACCOUNT_ID || '45efe64168fc55da3937e2c01b1ca43a',
  siteHost: 'globalperspective.net',
  graphqlUrl: 'https://api.cloudflare.com/client/v4/graphql',
  restBase: 'https://api.cloudflare.com/client/v4',
  topN: 10,
  rowLimit: 10000,   // GraphQL rows per query (the API maximum); 14 days x pages stays far below it today
  // Page families: ONE table. A path matches an `exact` entry or an entry as a prefix at a segment boundary (/daily matches
  // /daily and /daily/2026-11-03, not /dailyx). First family that matches wins; nothing matching is `other`. `ops` is excluded from totals.
  // `features` are the scripts/functions.json feature names whose Lambdas are charged to the family in attention-vs-effort.
  families: [
    { id: 'map', label: 'Map', exact: ['/'], prefix: ['/map', '/breaking'], features: ['home', 'map', 'breaking'] },
    { id: 'stories', label: 'Stories', exact: ['/weekly', '/today'], prefix: ['/weekly/thread'], features: ['threads'] },
    { id: 'countries', label: 'Countries', exact: ['/weekly/countries'], prefix: ['/weekly/country'], features: ['countries'] },
    { id: 'briefings', label: 'Briefings', exact: ['/briefings', '/weekly-brief'], prefix: ['/daily'], features: ['briefings'] },
    { id: 'trackRecord', label: 'Track record', exact: [], prefix: ['/track-record'], features: ['track-record'] },
    { id: 'board', label: 'Board', exact: [], prefix: ['/board'], features: ['board'] },
    { id: 'ops', label: 'Ops', exact: ['/ops'], prefix: [], features: [], excludedFromTotals: true },
  ],
  otherFamily: { id: 'other', label: 'Other', features: [] },
  storyPrefix: '/weekly/thread/',
  countryPrefix: '/weekly/country/',
  // Deployed Lambda -> features, copied from scripts/functions.json (test/readers.test.js fails when the two differ). Lambdas with no
  // feature, or only `ops`, are left out.
  lambdaFeatures: {
    newsAnalyze: ['analysis-studio'],
    newsBoard: ['board'],
    newsBreakingAlert: ['breaking'],
    newsCountryFactsUpdater: ['countries'],
    newsCountryIntelligence: ['countries', 'map'],
    newsDriftCorrector: ['countries', 'account', 'analysis-studio'],
    newsEmailSender: ['briefings', 'breaking', 'account'],
    newsGdacsIngest: ['map'],
    newsIngest: ['home', 'threads', 'map'],
    newsPolarBilling: ['account'],
    newsDailyBrief: ['briefings'],
    newsPredictionResolver: ['track-record'],
    newsAgent: ['home', 'threads', 'map', 'countries', 'analysis-studio', 'briefings', 'track-record'],
    newsRecommend: ['account', 'breaking'],
    newsSavedItems: ['account'],
    newsReadApi: ['home', 'threads', 'map', 'countries', 'briefings', 'analysis-studio', 'track-record', 'account'],
    newsSharedAnalysis: ['analysis-studio'],
    newsSituationIngest: ['map'],
    newsSituationTracker: ['map', 'threads'],
    newsStoryRecord: ['board', 'threads'],
    newsRecordReview: ['threads'],
    newsSystemsAnalysis: ['countries', 'threads'],
    newsThreadAnalysis: ['threads', 'map', 'analysis-studio'],
    newsWeeklyBrief: ['briefings'],
  },
  // Own tables (read-only Scan, projection only; no uid or email is read).
  tables: { users: 'GlobalPerspectiveUserTable', saved: 'GlobalPerspectiveSavedItems', shares: 'GlobalPerspectiveShares' },
};

const STAGES = [
  { id: 'ingest', label: 'Ingest ran' },
  { id: 'agent', label: 'Agent wrote the archive' },
  { id: 'record', label: 'Record run' },
  { id: 'views', label: 'Views refreshed' },
  { id: 'resolver', label: 'Resolver' },
  { id: 'situations', label: 'Situations' },
  { id: 'briefs', label: 'Briefs' },
  { id: 'errors', label: 'Lambda errors' },
  { id: 'compare', label: 'Compare switches' },
];

module.exports = { REGION, BUCKET, KEYS, CONFIG, STAGES, READERS };
