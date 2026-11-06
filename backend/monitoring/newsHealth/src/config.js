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
  mergesPrefix: 'situations/merges/',   // newsSituationTracker: YYYY/MM/DD/HH/HHMM.json, one file per sweep that made new merges
  healPrefix: 'monitoring/heal/',       // self-healing ledger DAY.json (newsHealth) and recover/DAY.json (newsRecover's result)
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
// operator (README). The query filters by `requestHost` (siteHost), so no site tag is needed.
const READERS = {
  accountId: process.env.CF_ACCOUNT_ID || '45efe64168fc55da3937e2c01b1ca43a',
  siteHost: 'globalperspective.net',
  graphqlUrl: 'https://api.cloudflare.com/client/v4/graphql',
  topN: 10,
  rowLimit: 10000,   // GraphQL rows per query (the API maximum); 14 days x pages stays far below it today
  // Page families (path -> family, and family -> functions.json features): the one table is pageFamilies.json.
  ...require('./pageFamilies.json'),
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

// Quality (ARCHITECTURE_OPS.md phase 3). Built once per UTC day, for the last closed UTC day (the record run for D finishes ~23:46 UTC
// on D, the agent and the resolver write D's files during D), plus a snapshot of the open situations at build time.
const QUALITY = {
  examples: 5,
  // Summaries that describe their sources instead of the news (the prompt forbids all of these: newsAgent buildSummaryPrompt rule 5/6).
  // Found 2026-11-05 in the 2026-11-04 entries: 16 of 32 summaries said "the snippet(s)", "the sources" or "the headline".
  // "the report" and bare "the articles" are not matched: they are ordinary news words ("the report said", "articles of impeachment").
  selfReference: String.raw`\b(?:according to the (?:provided |given |available )?(?:articles?|sources?|snippets?)|the (?:provided |given |available )?(?:snippets?|sources?)|the headlines?)\b`,
  coverageDays: 14,                         // days of record/runs/DAY.json read for coverage gaps
  auditGroup: '/aws/lambda/newsSourceAudit',
  auditWindowDays: 7,                       // newsSourceAudit runs Mon/Wed/Fri: the longest gap is 3 days; 7 leaves room for one miss
  auditMaxWaitMs: 30000,
  errorsTable: 'GlobalPerspectiveClientErrors',   // newsClientErrors: key errKey = DAY#hash16, attributes day, count, sampleUrl; TTL 30 days
  errorsBaselineDays: 14,                   // the median is over the 14 days before the checked day
  errorsTopPages: 8,
};

// Self-healing (ARCHITECTURE_OPS.md phase 4, src/heal.js). HEAL env: 'on' acts, 'dry' only reports what it would do, anything else is off.
// Times are UTC. Scheduled runs (scripts/functions.json): ingest 04:15/12:15/20:15, agent :25 (about a minute, timeout 15 min), record
// refresh :35, the nightly record run 23:45. The healer starts nothing from :10 to :55 of 04/12/20 or from 23:40 to 00:10.
const HEAL = {
  mode: process.env.HEAL || 'off',
  lookbackDays: 2,                          // today, yesterday and the day before
  agentFromMin: 21 * 60,                    // the agent re-run window opens at 21:00 UTC (06:00 JST): the 20:25 run is long over
  agentToMin: 23 * 60,                      // and closes at 23:00, so a re-run is finished well before the 23:45 record run
  quiet: [[4 * 60 + 10, 4 * 60 + 55], [12 * 60 + 10, 12 * 60 + 55], [20 * 60 + 10, 20 * 60 + 55], [23 * 60 + 40, 10]],
  inflightMin: 20,                          // an invoked run is given this long to show its result (agent about 1 min, ingest under 1 min)
  recoverFromMin: 30,                       // recovery of a closed day D starts at D+1 00:30 UTC (GDELT's last quarter-hour file is out)
  recoverUntilHours: 48,                    // and gives up 48 h after the day closed
  recoverAttempts: 3,                       // newsRecover invokes per day
  recordAttempts: 2,                        // newsStoryRecord recovery invokes per day
  // A recovered day is 1,624 lines for 2026-09-18 (GDELT GKG) against 760 captured live on 2026-11-04; under this the records did not
  // cover the day and it is not called recovered.
  minArticles: 300,
  functions: { agent: 'newsAgent', ingest: 'newsIngest', record: 'newsStoryRecord', recover: 'newsRecover' },
  stagingTable: 'NewsCache',                // the ingest's staging item, key id = 'staging' (read only)
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

module.exports = { REGION, BUCKET, KEYS, CONFIG, STAGES, READERS, QUALITY, HEAL };
