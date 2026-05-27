/**
 * newsMarketsData — free economic data ingest Lambda
 *
 * Sources (all free, no paid feeds):
 *   - Frankfurter (ECB FX rates, no key)       — hourly
 *   - FRED (bond yields, free key)              — daily
 *   - World Bank (country macros, no key)       — weekly
 *   - Stooq CSV (commodities, no key)           — hourly (15-min delayed)
 *
 * DDB table: MARKETS_DDB_TABLE
 *   PK                    SK                   Contents
 *   FX#USD                LATEST               { rates: {EUR,JPY,ARS,...}, asOf }
 *   FX#USD                HISTORY#YYYY-MM-DD   daily snapshot for sparklines
 *   RATES#GLOBAL          LATEST               { US10Y, US2Y, UK10Y, DE10Y, JP10Y, asOf }
 *   COMMODITIES#GLOBAL    LATEST               { brent, wti, gold, copper, vix, dxy, asOf }
 *   EQUITIES#GLOBAL       LATEST               { SPX, NDX, DJI, ..., XLE, SOXX, ..., asOf }
 *   EQUITIES#GLOBAL       HISTORY#YYYY-MM-DD   daily snapshot for sparklines
 *   CRYPTO#GLOBAL         LATEST               { BTC, BTC_24h_change, ETH, ETH_24h_change, asOf }
 *   CRYPTO#GLOBAL         HISTORY#YYYY-MM-DD   daily snapshot for sparklines
 *   MACRO#{country}       LATEST               { gdp, cpi_yoy, reserves_usd, debt_to_gdp,
 *                                                current_account, unemployment, asOf }
 *   MACRO#{country}       HISTORY#YYYY-Q#      quarterly history
 *
 * EventBridge payloads:
 *   {}                       → run all sources appropriate for current time
 *   { "source": "fx" }       → FX only
 *   { "source": "yields" }   → FRED yields only
 *   { "source": "macros" }   → World Bank macros only
 *   { "source": "commodities" } → Stooq commodities only
 *   { "source": "equities" } → Stooq indices + ETFs only
 *   { "source": "crypto" } → CoinGecko BTC + ETH only
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
// Table name: GlobalPerspectiveMarkets (ap-northeast-1)
const TABLE = process.env.MARKETS_DDB_TABLE || 'GlobalPerspectiveMarkets';
const FRED_KEY = process.env.FRED_API_KEY;

const NOW_ISO = () => new Date().toISOString();
const TODAY   = () => new Date().toISOString().slice(0, 10);
const TTL_DAYS = (d) => Math.floor(Date.now() / 1000) + d * 86400;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function safeFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res;
}

async function putItem(pk, sk, data, ttlDays = 7) {
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { pk, sk, ...data, ttl: TTL_DAYS(ttlDays), updatedAt: NOW_ISO() },
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 1 — FRANKFURTER (ECB FX, no key required)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFX() {
  console.log('[FX] fetching from Frankfurter...');
  const res = await safeFetch('https://api.frankfurter.app/latest?from=USD');
  const json = await res.json();
  // json.rates: { EUR, GBP, JPY, ARS, TRY, CNY, BRL, ... }
  const payload = { rates: json.rates, base: 'USD', asOf: json.date };

  await putItem('FX#USD', 'LATEST', payload, 2);
  await putItem('FX#USD', `HISTORY#${TODAY()}`, payload, 90);
  console.log(`[FX] stored ${Object.keys(json.rates).length} pairs`);
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 2 — FRED (bond yields, free API key)
// Key env: FRED_API_KEY — get free at https://fred.stlouisfed.org/docs/api/api_key.html
// ─────────────────────────────────────────────────────────────────────────────

const FRED_SERIES = {
  US10Y: 'DGS10',   // 10-Year Treasury
  US2Y:  'DGS2',    // 2-Year Treasury
  UK10Y: 'IRLTLT01GBM156N',  // UK long-term yield
  DE10Y: 'IRLTLT01DEM156N',  // Germany 10Y
  JP10Y: 'IRLTLT01JPM156N',  // Japan 10Y
};

async function fetchFREDSeries(seriesId) {
  if (!FRED_KEY) throw new Error('FRED_API_KEY not set');
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&limit=1&sort_order=desc&api_key=${FRED_KEY}&file_type=json`;
  const res = await safeFetch(url);
  const json = await res.json();
  const obs = json.observations?.[0];
  if (!obs || obs.value === '.') return null;
  return parseFloat(obs.value);
}

async function fetchYields() {
  console.log('[YIELDS] fetching from FRED...');
  const results = {};
  for (const [key, seriesId] of Object.entries(FRED_SERIES)) {
    try {
      results[key] = await fetchFREDSeries(seriesId);
    } catch (e) {
      console.warn(`[YIELDS] ${key} failed: ${e.message}`);
      results[key] = null;
    }
  }
  const payload = { ...results, asOf: NOW_ISO() };
  await putItem('RATES#GLOBAL', 'LATEST', payload, 2);
  await putItem('RATES#GLOBAL', `HISTORY#${TODAY()}`, payload, 90);
  console.log('[YIELDS] stored:', results);
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 3 — WORLD BANK (country macros, no key)
// Indicators: GDP, CPI, Reserves, Debt/GDP, Current Account, Unemployment
// ─────────────────────────────────────────────────────────────────────────────

const WB_INDICATORS = {
  gdp_usd:         'NY.GDP.MKTP.CD',
  cpi_yoy:         'FP.CPI.TOTL.ZG',
  reserves_usd:    'FI.RES.TOTL.CD',
  debt_to_gdp:     'GC.DOD.TOTL.GD.ZS',
  current_account: 'BN.CAB.XOKA.GD.ZS',
  unemployment:    'SL.UEM.TOTL.ZS',
};

// ISO3 codes for top ~50 countries by global news volume
// Covers the countries most commonly appearing in our topic archive
const TOP_COUNTRIES = [
  { name: 'United States', iso3: 'USA', iso2: 'US' },
  { name: 'China', iso3: 'CHN', iso2: 'CN' },
  { name: 'Russia', iso3: 'RUS', iso2: 'RU' },
  { name: 'Germany', iso3: 'DEU', iso2: 'DE' },
  { name: 'United Kingdom', iso3: 'GBR', iso2: 'GB' },
  { name: 'France', iso3: 'FRA', iso2: 'FR' },
  { name: 'Japan', iso3: 'JPN', iso2: 'JP' },
  { name: 'India', iso3: 'IND', iso2: 'IN' },
  { name: 'Brazil', iso3: 'BRA', iso2: 'BR' },
  { name: 'South Korea', iso3: 'KOR', iso2: 'KR' },
  { name: 'Australia', iso3: 'AUS', iso2: 'AU' },
  { name: 'Canada', iso3: 'CAN', iso2: 'CA' },
  { name: 'Italy', iso3: 'ITA', iso2: 'IT' },
  { name: 'Spain', iso3: 'ESP', iso2: 'ES' },
  { name: 'Mexico', iso3: 'MEX', iso2: 'MX' },
  { name: 'Indonesia', iso3: 'IDN', iso2: 'ID' },
  { name: 'Saudi Arabia', iso3: 'SAU', iso2: 'SA' },
  { name: 'Turkey', iso3: 'TUR', iso2: 'TR' },
  { name: 'Argentina', iso3: 'ARG', iso2: 'AR' },
  { name: 'Iran', iso3: 'IRN', iso2: 'IR' },
  { name: 'Israel', iso3: 'ISR', iso2: 'IL' },
  { name: 'Ukraine', iso3: 'UKR', iso2: 'UA' },
  { name: 'Taiwan', iso3: 'TWN', iso2: 'TW' },
  { name: 'Poland', iso3: 'POL', iso2: 'PL' },
  { name: 'Netherlands', iso3: 'NLD', iso2: 'NL' },
  { name: 'Pakistan', iso3: 'PAK', iso2: 'PK' },
  { name: 'Bangladesh', iso3: 'BGD', iso2: 'BD' },
  { name: 'Egypt', iso3: 'EGY', iso2: 'EG' },
  { name: 'Nigeria', iso3: 'NGA', iso2: 'NG' },
  { name: 'Ethiopia', iso3: 'ETH', iso2: 'ET' },
  { name: 'South Africa', iso3: 'ZAF', iso2: 'ZA' },
  { name: 'Kenya', iso3: 'KEN', iso2: 'KE' },
  { name: 'Mali', iso3: 'MLI', iso2: 'ML' },
  { name: 'Sudan', iso3: 'SDN', iso2: 'SD' },
  { name: 'Venezuela', iso3: 'VEN', iso2: 'VE' },
  { name: 'Colombia', iso3: 'COL', iso2: 'CO' },
  { name: 'Chile', iso3: 'CHL', iso2: 'CL' },
  { name: 'Peru', iso3: 'PER', iso2: 'PE' },
  { name: 'Vietnam', iso3: 'VNM', iso2: 'VN' },
  { name: 'Thailand', iso3: 'THA', iso2: 'TH' },
  { name: 'Philippines', iso3: 'PHL', iso2: 'PH' },
  { name: 'Myanmar', iso3: 'MMR', iso2: 'MM' },
  { name: 'North Korea', iso3: 'PRK', iso2: 'KP' },
  { name: 'Afghanistan', iso3: 'AFG', iso2: 'AF' },
  { name: 'Syria', iso3: 'SYR', iso2: 'SY' },
  { name: 'Yemen', iso3: 'YEM', iso2: 'YE' },
  { name: 'Iraq', iso3: 'IRQ', iso2: 'IQ' },
  { name: 'Lebanon', iso3: 'LBN', iso2: 'LB' },
  { name: 'Libya', iso3: 'LBY', iso2: 'LY' },
  { name: 'Greece', iso3: 'GRC', iso2: 'GR' },
];

async function fetchWBIndicator(iso3, indicatorCode) {
  // World Bank returns last 5 years; take most recent non-null value
  const url = `https://api.worldbank.org/v2/country/${iso3}/indicator/${indicatorCode}?format=json&mrv=5&per_page=5`;
  const res = await safeFetch(url);
  const json = await res.json();
  const data = json[1];
  if (!Array.isArray(data)) return null;
  const latest = data.find(d => d.value !== null);
  return latest ? { value: latest.value, year: latest.date } : null;
}

async function fetchMacrosForCountry(country) {
  const macro = { country: country.name, iso2: country.iso2, asOf: NOW_ISO() };
  for (const [key, code] of Object.entries(WB_INDICATORS)) {
    try {
      macro[key] = await fetchWBIndicator(country.iso3, code);
      // throttle slightly — World Bank has no published rate limit but be polite
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.warn(`[MACROS] ${country.name} ${key} failed: ${e.message}`);
      macro[key] = null;
    }
  }
  return macro;
}

async function fetchMacros() {
  console.log(`[MACROS] fetching World Bank data for ${TOP_COUNTRIES.length} countries...`);
  let stored = 0;
  for (const country of TOP_COUNTRIES) {
    try {
      const macro = await fetchMacrosForCountry(country);
      await putItem(`MACRO#${country.name}`, 'LATEST', macro, 90);
      stored++;
    } catch (e) {
      console.warn(`[MACROS] ${country.name} failed entirely: ${e.message}`);
    }
  }
  console.log(`[MACROS] stored ${stored}/${TOP_COUNTRIES.length} countries`);
  return { stored };
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 4 — STOOQ CSV (commodities + indices, 15-min delayed, no key)
// ─────────────────────────────────────────────────────────────────────────────

// Stooq symbols: brent=brn.f, wti=cl.f, gold=gc.f, copper=hg.f, vix=^vix, dxy=dx.f
const STOOQ_SYMBOLS = {
  brent:  'cb.f',   // ICE Brent Crude
  wti:    'cl.f',   // NYMEX WTI Crude
  gold:   'gc.f',   // COMEX Gold
  copper: 'hg.f',   // COMEX Copper
  dxy:    'dx.f',   // US Dollar Index
  natgas: 'ng.f',    // Henry Hub natural gas
};

// Stooq index symbols (^ prefix). If any symbol fails at runtime, value is null.
// Verify on stooq.com if a key returns null persistently.
const STOOQ_INDICES = {
  SPX:   '^spx',     // S&P 500
  NDX:   '^ndx',     // Nasdaq 100
  DJI:   '^dji',     // Dow Jones Industrial
  IWM:   'iwm.us',   // iShares Russell 2000 ETF (proxy — Stooq lacks ^rut; small-cap/domestic-economy gauge)
  FTM:   '^ftm',     // FTSE 100
  DAX:   '^dax',     // DAX
  N225:  '^nkx',     // Nikkei 225
  HSI:   '^hsi',     // Hang Seng
  SSEC:  '^shc',     // Shanghai Composite
  KS11:  '^kospi',   // KOSPI
  TWII:  '^twse',    // Taiwan Weighted
  INDA:  'inda.us',  // iShares MSCI India ETF (proxy — Stooq lacks NSEI)
  BVSP:  '^bvp',     // Bovespa
  MERV:  '^mrv',     // Merval (Argentina)
  XU100: '^xu100',   // BIST 100 (Turkey)
  EIS:   'eis.us',   // iShares MSCI Israel ETF (proxy — Stooq lacks TA125)
};

// US-listed sector + credit ETFs (.us suffix on Stooq)
const STOOQ_ETFS = {
  XLE:  'xle.us',    // Energy
  ITA:  'ita.us',    // US Defense
  SOXX: 'soxx.us',   // Semiconductors
  XLF:  'xlf.us',    // Financials
  EEM:  'eem.us',    // MSCI EM
  EFA:  'efa.us',    // MSCI Dev ex-US
  GDX:  'gdx.us',    // Gold miners
  SHY:  'shy.us',    // Short Treasuries
  EMB:  'emb.us',    // EM USD bonds
  HYG:  'hyg.us',    // US high yield
  XLK:  'xlk.us',    // Technology
  XLV:  'xlv.us',    // Health Care
  XLI:  'xli.us',    // Industrials
  XLY:  'xly.us',    // Consumer Discretionary
  XLP:  'xlp.us',    // Consumer Staples
  XLU:  'xlu.us',    // Utilities
  XLB:  'xlb.us',    // Materials
  XLRE: 'xlre.us',   // Real Estate
  XLC:  'xlc.us',    // Communication Services
  DBA:  'dba.us',    // Agriculture / grains
  REMX: 'remx.us',   // Rare earths / critical minerals
};

async function fetchStooqSymbol(symbol) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
  const res = await safeFetch(url);
  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;
  // Header: Symbol,Date,Time,Open,High,Low,Close,Volume
  const parts = lines[1].split(',');
  const close = parseFloat(parts[6]);
  return isNaN(close) ? null : close;
}

async function fetchVIX() {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d';
  const res = await safeFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const json = await res.json();
  return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
}

async function fetchCommodities() {
  console.log('[COMMODITIES] fetching from Stooq + Yahoo...');
  const result = { asOf: NOW_ISO() };
  for (const [key, symbol] of Object.entries(STOOQ_SYMBOLS)) {
    try {
      result[key] = await fetchStooqSymbol(symbol);
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.warn(`[COMMODITIES] ${key} failed: ${e.message}`);
      result[key] = null;
    }
  }
  try {
    result.vix = await fetchVIX();
  } catch (e) {
    console.warn(`[COMMODITIES] vix failed: ${e.message}`);
    result.vix = null;
  }
  await putItem('COMMODITIES#GLOBAL', 'LATEST', result, 1);
  await putItem('COMMODITIES#GLOBAL', `HISTORY#${TODAY()}`, result, 90);
  console.log('[COMMODITIES] stored:', result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 5 — COINGECKO (BTC + ETH, free, no key, 30 req/min)
// Only BTC + ETH — surfaced when economic_impact tags geopoliticalRelevance.
// ─────────────────────────────────────────────────────────────────────────────

async function fetchCrypto() {
  console.log('[CRYPTO] fetching BTC + ETH from CoinGecko...');
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';
  try {
    const res = await safeFetch(url);
    const json = await res.json();
    const result = {
      BTC: json.bitcoin?.usd ?? null,
      BTC_24h_change: json.bitcoin?.usd_24h_change ?? null,
      ETH: json.ethereum?.usd ?? null,
      ETH_24h_change: json.ethereum?.usd_24h_change ?? null,
      asOf: NOW_ISO(),
    };
    await putItem('CRYPTO#GLOBAL', 'LATEST', result, 2);
    await putItem('CRYPTO#GLOBAL', `HISTORY#${TODAY()}`, result, 90);
    console.log('[CRYPTO] stored:', { BTC: result.BTC, ETH: result.ETH });
    return result;
  } catch (e) {
    console.warn(`[CRYPTO] failed: ${e.message}`);
    return { error: e.message };
  }
}

async function fetchEquitiesAndETFs() {
  console.log('[EQUITIES] fetching from Stooq...');
  const result = { asOf: NOW_ISO() };
  const all = { ...STOOQ_INDICES, ...STOOQ_ETFS };
  for (const [key, symbol] of Object.entries(all)) {
    try {
      result[key] = await fetchStooqSymbol(symbol);
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.warn(`[EQUITIES] ${key} failed: ${e.message}`);
      result[key] = null;
    }
  }
  await putItem('EQUITIES#GLOBAL', 'LATEST', result, 2);
  await putItem('EQUITIES#GLOBAL', `HISTORY#${TODAY()}`, result, 90);
  const count = Object.values(result).filter(v => typeof v === 'number').length;
  console.log(`[EQUITIES] stored ${count} prices`);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED HISTORY — one-time backfill of ~30 days of daily closes from Yahoo Finance
//
// Writes the SAME per-date row shape the daily cron writes:
//   COMMODITIES#GLOBAL  HISTORY#YYYY-MM-DD   { brent, wti, gold, copper, dxy, vix, natgas, asOf }
//   EQUITIES#GLOBAL     HISTORY#YYYY-MM-DD   { SPX, NDX, ..., XLE, ..., asOf }
//   CRYPTO#GLOBAL       HISTORY#YYYY-MM-DD   { BTC, ETH, asOf }
//
// Only fills dates strictly BEFORE today (UTC) — today is left to the daily cron.
// Skips any date that already has a row so a real cron-written row is never clobbered.
// Fetches sequentially with a delay (Yahoo blocks bursts); a failed/empty symbol is
// logged and skipped, never crashing the run.
//
// Invoke: { "source": "seed_history" }
// ─────────────────────────────────────────────────────────────────────────────

// Our instrument key → Yahoo symbol. ALL verified live 2026-05-27 (range=5d returned
// timestamps + closes for every symbol; zero drops).
const YAHOO_COMMODITIES = {
  brent:  'BZ=F',
  wti:    'CL=F',
  gold:   'GC=F',
  copper: 'HG=F',
  natgas: 'NG=F',
  vix:    '^VIX',
  dxy:    'DX-Y.NYB',
};

const YAHOO_EQUITIES = {
  // Indices
  SPX:   '^GSPC',
  NDX:   '^NDX',
  DJI:   '^DJI',
  FTM:   '^FTSE',
  DAX:   '^GDAXI',
  N225:  '^N225',
  HSI:   '^HSI',
  SSEC:  '000001.SS',
  KS11:  '^KS11',
  TWII:  '^TWII',
  BVSP:  '^BVSP',
  MERV:  '^MERV',
  XU100: 'XU100.IS',
  INDA:  'INDA',
  EIS:   'EIS',
  IWM:   'IWM',
  // Sector / thematic ETFs
  XLE:  'XLE',
  XLF:  'XLF',
  XLK:  'XLK',
  XLV:  'XLV',
  XLI:  'XLI',
  XLY:  'XLY',
  XLP:  'XLP',
  XLU:  'XLU',
  XLB:  'XLB',
  XLRE: 'XLRE',
  XLC:  'XLC',
  ITA:  'ITA',
  SOXX: 'SOXX',
  GDX:  'GDX',
  EEM:  'EEM',
  EFA:  'EFA',
  SHY:  'SHY',
  EMB:  'EMB',
  HYG:  'HYG',
  DBA:  'DBA',
  REMX: 'REMX',
};

const YAHOO_CRYPTO = {
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
};

const SEED_DELAY_MS = 300; // ≥250ms between Yahoo calls — defensive against burst blocking

// Fetch a Yahoo daily series. Returns { 'YYYY-MM-DD': close, ... } (null closes skipped),
// or null on any failure/empty response (caller logs + skips the symbol).
async function fetchYahooDailySeries(yahooSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2mo`;
  const res = await safeFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return null;
  const series = {};
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close === null || close === undefined || isNaN(close)) continue;
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    series[date] = close;
  }
  return Object.keys(series).length ? series : null;
}

// Fetch every instrument in a map sequentially (with delay) and transpose into a
// per-date field map: { 'YYYY-MM-DD': { field: value, ... } }.
async function buildCategorySeries(category, instrumentMap) {
  const byDate = {};            // date → { field: close }
  const perInstrument = {};     // field → point count
  const skipped = [];
  for (const [field, yahooSymbol] of Object.entries(instrumentMap)) {
    try {
      const series = await fetchYahooDailySeries(yahooSymbol);
      if (!series) {
        console.warn(`[SEED][${category}] ${field} (${yahooSymbol}) returned empty — skipping`);
        skipped.push(`${field}=${yahooSymbol}`);
      } else {
        let count = 0;
        for (const [date, value] of Object.entries(series)) {
          (byDate[date] || (byDate[date] = {}))[field] = value;
          count++;
        }
        perInstrument[field] = count;
        console.log(`[SEED][${category}] ${field} (${yahooSymbol}): ${count} points`);
      }
    } catch (e) {
      console.warn(`[SEED][${category}] ${field} (${yahooSymbol}) failed: ${e.message} — skipping`);
      skipped.push(`${field}=${yahooSymbol}`);
    }
    await new Promise(r => setTimeout(r, SEED_DELAY_MS));
  }
  return { byDate, perInstrument, skipped };
}

// Does a HISTORY row already exist for this pk/date? Used to skip (never clobber) a
// real daily-cron row.
async function historyRowExists(pk, date) {
  const res = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { pk, sk: `HISTORY#${date}` },
  }));
  return !!res.Item;
}

// Write the per-date rows for one category, skipping today (UTC) and any date that
// already has a row.
async function writeCategoryHistory(pk, byDate, today) {
  let written = 0;
  const skippedDates = [];
  for (const date of Object.keys(byDate).sort()) {
    if (date >= today) continue;          // leave today (and anything future) to the daily cron
    if (await historyRowExists(pk, date)) {
      skippedDates.push(date);            // never clobber an existing (cron) row
      continue;
    }
    const asOf = `${date}T00:00:00.000Z`;
    await putItem(pk, `HISTORY#${date}`, { ...byDate[date], asOf }, 35);
    written++;
  }
  return { written, skippedDates };
}

async function seedHistory() {
  console.log('[SEED] one-time history backfill from Yahoo Finance...');
  const today = TODAY();

  const categories = [
    { name: 'commodities', pk: 'COMMODITIES#GLOBAL', map: YAHOO_COMMODITIES },
    { name: 'equities',    pk: 'EQUITIES#GLOBAL',    map: YAHOO_EQUITIES },
    { name: 'crypto',      pk: 'CRYPTO#GLOBAL',       map: YAHOO_CRYPTO },
  ];

  const seeded = {};
  const perInstrument = {};
  const skippedSymbols = [];

  for (const cat of categories) {
    console.log(`[SEED] === ${cat.name} ===`);
    const { byDate, perInstrument: pi, skipped } = await buildCategorySeries(cat.name, cat.map);
    Object.assign(perInstrument, pi);
    skippedSymbols.push(...skipped);
    const { written, skippedDates } = await writeCategoryHistory(cat.pk, byDate, today);
    seeded[cat.name] = written;
    console.log(`[SEED] ${cat.name}: wrote ${written} date rows, skipped ${skippedDates.length} existing (${skippedDates.join(', ') || 'none'})`);
  }

  const summary = { seeded, perInstrument, skippedSymbols };
  console.log('[SEED] done:', JSON.stringify(summary, null, 2));
  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────

exports.handler = async (event = {}) => {
  console.log('[newsMarketsData] event:', JSON.stringify(event));

  if (!TABLE) {
    console.error('MARKETS_DDB_TABLE env var not set');
    return { statusCode: 500, body: 'Missing MARKETS_DDB_TABLE' };
  }

  const source = event?.source || 'all';
  const hourUTC = new Date().getUTCHours();
  const dayUTC  = new Date().getUTCDay(); // 0=Sun

  const results = {};

  // Seed history — one-time backfill, manual invoke only ({ "source": "seed_history" })
  if (source === 'seed_history') {
    try { results.seed_history = await seedHistory(); }
    catch (e) { console.error('[SEED] failed:', e.message); results.seed_history = { error: e.message }; }
    console.log('[newsMarketsData] done:', JSON.stringify(results, null, 2));
    return { statusCode: 200, body: results };
  }

  // FX — run if source=fx or source=all (hourly)
  if (source === 'fx' || source === 'all') {
    try { results.fx = await fetchFX(); }
    catch (e) { console.error('[FX] failed:', e.message); results.fx = { error: e.message }; }
  }

  // Commodities — run if source=commodities or source=all (hourly)
  if (source === 'commodities' || source === 'all') {
    try { results.commodities = await fetchCommodities(); }
    catch (e) { console.error('[COMMODITIES] failed:', e.message); results.commodities = { error: e.message }; }
  }

  // Equities + ETFs — run if source=equities or source=all (hourly)
  if (source === 'equities' || source === 'all') {
    try { results.equities = await fetchEquitiesAndETFs(); }
    catch (e) { console.error('[EQUITIES] failed:', e.message); results.equities = { error: e.message }; }
  }

  // Crypto — run if source=crypto or source=all (hourly)
  if (source === 'crypto' || source === 'all') {
    try { results.crypto = await fetchCrypto(); }
    catch (e) { console.error('[CRYPTO] failed:', e.message); results.crypto = { error: e.message }; }
  }

  // Yields — run if source=yields or source=all on weekdays 06-22 UTC
  if (source === 'yields' || (source === 'all' && hourUTC >= 6 && hourUTC <= 22 && dayUTC >= 1 && dayUTC <= 5)) {
    try { results.yields = await fetchYields(); }
    catch (e) { console.error('[YIELDS] failed:', e.message); results.yields = { error: e.message }; }
  }

  // Macros — run if source=macros or source=all on Sundays at 02:00 UTC (weekly)
  if (source === 'macros' || (source === 'all' && dayUTC === 0 && hourUTC === 2)) {
    try { results.macros = await fetchMacros(); }
    catch (e) { console.error('[MACROS] failed:', e.message); results.macros = { error: e.message }; }
  }

  console.log('[newsMarketsData] done:', JSON.stringify(results, null, 2));
  return { statusCode: 200, body: results };
};
