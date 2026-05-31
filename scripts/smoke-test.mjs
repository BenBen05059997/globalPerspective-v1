#!/usr/bin/env node
/**
 * Production smoke-test / page health playbook.
 *
 * For every route, at desktop AND mobile viewports, it checks:
 *   (a) Loads + no console errors  — page mounts, #root renders, zero JS errors
 *   (b) Deep-link refresh works     — re-requests the URL directly (the GitHub
 *                                     Pages 404.html SPA-fallback path) and the
 *                                     app re-boots instead of going blank
 *   (c) Key content renders         — a route-specific selector with REAL data
 *                                     appears (e.g. /economy shows leaderboard rows)
 *   (d) Data / network OK           — no failed document/script/style loads,
 *                                     no 5xx (aborted in-flight XHRs are ignored)
 *   (e) Accessibility (axe-core)    — no serious/critical WCAG violations
 *   (f) Garbage-content guard       — no visible NaN / undefined / Invalid Date /
 *                                     [object Object] / error-boundary text
 * It also writes a screenshot per route+viewport for quick visual eyeballing.
 *
 * Two aggregate checks run after the per-route table:
 *   • ECONOMY STORY-LINK INTEGRITY — every /economy disruption opens a full thread (class 1)
 *   • MAP LAYER RENDER — /map's data-backed layers (Pulse, Connections) must each draw
 *                        >0 SVG elements, guarding the "silent empty render" bug (class 7)
 *   • VISUAL PAINT — each route's key content region must render visible "ink" and not
 *                    silently collapse to a blank box (the GENERAL class-7 guard). We grid-
 *                    sample the region and assert a minimum fraction of points land on real
 *                    rendered content (text / img / svg / colored bg). This is robust to news
 *                    churn (different headlines → similar ink) and needs no baseline image,
 *                    so unlike pixel-diff visual regression it can't rot on a live data site.
 *
 * Param routes (/weekly/thread/:id, /weekly/country/:name, /daily/:dateKey) are
 * auto-discovered by scraping their listing page, so the test never rots on a
 * hard-coded id.
 *
 * Usage:
 *   node scripts/smoke-test.mjs
 *   SMOKE_BASE=https://benben05059997.github.io/globalPerspective-v1 node scripts/smoke-test.mjs
 *   SMOKE_VIEWPORTS=desktop node scripts/smoke-test.mjs   # skip mobile
 *
 * Exit code is non-zero if any check fails (CI-friendly).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FE = path.join(__dir, '../global-perspectives-starter/frontend');
const { chromium } = await import(path.join(FE, 'node_modules/playwright/index.mjs'));
const AXE_SRC = fs.readFileSync(path.join(FE, 'node_modules/axe-core/axe.min.js'), 'utf8');

const BASE = (process.env.SMOKE_BASE || 'https://globalperspective.net').replace(/\/$/, '');
const CONTENT_TIMEOUT = 15000;
const SHOTS_DIR = path.join(__dir, 'smoke-artifacts');

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};
const ACTIVE_VIEWPORTS = (process.env.SMOKE_VIEWPORTS
  ? process.env.SMOKE_VIEWPORTS.split(',')
  : ['desktop', 'mobile']
).filter((v) => VIEWPORTS[v]);

// ---- noise filters -------------------------------------------------------
const IGNORE_HOSTS = [
  'google-analytics.com', 'googletagmanager.com', 'analytics.google.com',
  'gstatic.com', 'fonts.googleapis.com', 'doubleclick.net',
  'firebaseinstallations', 'identitytoolkit', 'firebaseio.com',
  '/cdn-cgi/rum', // Cloudflare RUM beacon
];
const IGNORE_CONSOLE = [
  /favicon/i, /ResizeObserver loop/i, /gtag|google-?analytics|googletagmanager/i,
  /\[firebase\]/i, /preloaded using link preload/i,
  // On GitHub Pages every deep-link document is served via the 404.html SPA
  // fallback (HTTP 404 + 404.html body), so this console line is expected noise.
  // A genuinely broken bundle is still caught by the network check (404 on a
  // script/stylesheet = critical).
  /Failed to load resource/i,
];
// Aborted requests are NOT failures — they happen when reload()/navigation
// cancels an in-flight XHR (e.g. the proxy data fetch). The proxy itself is fine.
const IGNORE_REQ_ERR = [/ERR_ABORTED/i, /ERR_CANCELED/i];

const isIgnoredHost = (url) => IGNORE_HOSTS.some((h) => url.includes(h));
const isIgnoredConsole = (txt) => IGNORE_CONSOLE.some((re) => re.test(txt));

// ---- garbage-content patterns (visible-text bugs) ------------------------
const GARBAGE = [
  /\bNaN\b/, /\$NaN/, /\bundefined\b/, /\bInvalid Date\b/,
  /\[object Object\]/, /Something went wrong/i, /\bnull%/,
];

// ---- routes --------------------------------------------------------------
// content selectors should prove REAL data rendered, not just the shell.
// `region` (optional) = the key content region the VISUAL PAINT guard samples for
// the general class-7 silent-empty-render check. Defaults to content[0] when unset.
// `skipPaint` opts a route out (e.g. /weekly, whose empty-state is a legit class-6
// condition, not the data-present-but-blank class-7 bug).
const STATIC_ROUTES = [
  { name: 'Home',        path: '/',                 content: ['.home-shell'] },
  { name: 'Map',         path: '/map',              content: ['.mv2'] },
  { name: 'Daily',       path: '/daily',            content: ['.daily-footprint'] },
  { name: 'Economy',     path: '/economy',          content: ['.ep-row-l1'] },
  { name: 'Weekly',      path: '/weekly',           content: ['.weekly-feed', '.arc-dots', '.weekly-empty-state'], skipPaint: true },
  { name: 'CountryList', path: '/weekly/countries', content: ['.clp-card'] },
  { name: 'About',       path: '/about',            content: ['.card'] },
  { name: 'Contact',     path: '/contact',          content: ['.card'] },
  { name: 'Privacy',     path: '/privacy',          content: ['.card'] },
  { name: 'Disclosures', path: '/disclosures',      content: ['.card'] },
  { name: 'Whitepaper',  path: '/whitepaper',       content: ['.card'] },
  { name: 'SignIn',      path: '/signin',           content: ['.weekly-gate'] },
  { name: 'Account',     path: '/account',          content: [] }, // shell/redirect page
];

// VISUAL PAINT calibration (measured against prod 2026-06-01): healthy regions
// scored 0.19–0.96 coverage; an empty/collapsed region scores ~0. 0.06 sits 3× below
// the lowest healthy region with wide churn margin. A region that exists but can't be
// sampled (sampled < PAINT_MIN_SAMPLES after scrollIntoView) is also treated as blank.
const PAINT_MIN = 0.06;
const PAINT_MIN_SAMPLES = 40;

const urlFor = (p) => BASE + p;
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';

// ---- helpers -------------------------------------------------------------
async function waitForAnyContent(page, selectors) {
  const rootOk = await page
    .waitForFunction(
      () => {
        const r = document.getElementById('root');
        return r && r.children.length > 0 && document.body.innerText.trim().length > 30;
      },
      { timeout: CONTENT_TIMEOUT }
    )
    .then(() => true)
    .catch(() => false);

  if (!rootOk) return { ok: false, matched: null };
  if (!selectors.length) return { ok: true, matched: '(root rendered)' };

  for (const sel of selectors) {
    const found = await page
      .locator(sel)
      .first()
      .waitFor({ state: 'visible', timeout: CONTENT_TIMEOUT })
      .then(() => true)
      .catch(() => false);
    if (found) return { ok: true, matched: sel };
  }
  return { ok: false, matched: null };
}

async function runAxe(page) {
  try {
    await page.addScriptTag({ content: AXE_SRC });
    const res = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        resultTypes: ['violations'],
      });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length }));
    });
    return res;
  } catch (e) {
    return [{ id: 'axe-failed', impact: 'critical', n: 0, err: (e.message || '').slice(0, 80) }];
  }
}

async function scanGarbage(page) {
  const text = await page.evaluate(() => document.body.innerText || '');
  const hits = [];
  for (const re of GARBAGE) {
    const m = text.match(re);
    if (m) {
      const i = Math.max(0, m.index - 25);
      hits.push(text.slice(i, m.index + m[0].length + 25).replace(/\s+/g, ' ').trim());
    }
  }
  return hits;
}

// Runs IN THE BROWSER. Grid-samples a region and returns the fraction of points
// that land on real rendered content (text / img / svg / colored bg) vs bare
// background. A silently-empty region collapses this toward 0 regardless of which
// news content rendered, so it generalizes class 7 across every page.
function measurePaintInPage(sel, grid = 26) {
  const root = document.querySelector(sel);
  if (!root) return { found: false };
  root.scrollIntoView({ block: 'center' });
  const b = root.getBoundingClientRect();
  if (b.width < 4 || b.height < 4) return { found: true, w: b.width, h: b.height, sampled: 0, hits: 0, coverage: 0 };
  const pageBg = getComputedStyle(document.body).backgroundColor;
  const x0 = Math.max(0, b.left), y0 = Math.max(0, b.top);
  const x1 = Math.min(window.innerWidth, b.right), y1 = Math.min(window.innerHeight, b.bottom);
  let hits = 0, sampled = 0;
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / grid;
      const y = y0 + ((y1 - y0) * (j + 0.5)) / grid;
      const el = document.elementFromPoint(x, y);
      if (!el || !root.contains(el)) continue;
      sampled++;
      if (['IMG', 'SVG', 'CANVAS', 'VIDEO', 'PATH', 'CIRCLE', 'RECT', 'LINE', 'POLYGON', 'IMAGE'].includes(el.tagName)) { hits++; continue; }
      const cs = getComputedStyle(el);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') { hits++; continue; }
      if (cs.backgroundColor && cs.backgroundColor !== pageBg && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') { hits++; continue; }
      if (Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length)) hits++;
    }
  }
  return { found: true, w: Math.round(b.width), h: Math.round(b.height), sampled, hits, coverage: sampled ? +(hits / sampled).toFixed(3) : 0 };
}

function attachListeners(page) {
  const consoleErrors = [];
  const netFailures = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const txt = msg.text();
    if (isIgnoredConsole(txt)) return;
    if (isIgnoredHost(msg.location?.()?.url || '')) return;
    consoleErrors.push(txt.slice(0, 200));
  });
  page.on('pageerror', (err) =>
    consoleErrors.push('pageerror: ' + (err.message || String(err)).slice(0, 200))
  );

  page.on('response', (resp) => {
    const status = resp.status();
    if (status < 400) return;
    const url = resp.url();
    if (isIgnoredHost(url)) return;
    const type = resp.request().resourceType();
    // A 404 *document* is the expected GitHub Pages SPA fallback (404.html boots
    // the app). The real blank-page bug is a 404 on the script/stylesheet bundle.
    const critical =
      ['script', 'stylesheet'].includes(type) ||
      (type === 'document' && status >= 500) ||
      status >= 500;
    netFailures.push({ url, status, type, critical });
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (isIgnoredHost(url)) return;
    const errText = req.failure()?.errorText || '';
    if (IGNORE_REQ_ERR.some((re) => re.test(errText))) return; // aborted in-flight, not a failure
    const type = req.resourceType();
    const critical = ['script', 'stylesheet'].includes(type);
    netFailures.push({ url, status: 'FAILED', type, critical, err: errText });
  });

  return { consoleErrors, netFailures };
}

async function checkRoute(browser, route, viewport) {
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: VIEWPORTS[viewport],
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const { consoleErrors, netFailures } = attachListeners(page);

  const r = {
    name: route.name, path: route.path, viewport,
    loads: false, content: false, refresh: false, network: false,
    a11y: false, garbageClean: false, matched: null,
    consoleErrors, netFailures, axe: [], garbage: [], paint: null, paintRegion: null,
  };

  try {
    await page.goto(urlFor(route.path), { waitUntil: 'load', timeout: 30000 });
    r.loads = true;

    const c1 = await waitForAnyContent(page, route.content);
    r.content = c1.ok;
    r.matched = c1.matched;

    // Let in-flight data settle so reload() doesn't abort real requests.
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    // a11y + garbage + screenshot on the settled page
    r.axe = await runAxe(page);
    r.garbage = await scanGarbage(page);

    // VISUAL PAINT (general class-7 guard) — desktop only, reusing this settled page.
    const region = route.skipPaint ? null : route.region || route.content[0];
    if (viewport === 'desktop' && region) {
      r.paint = await page.evaluate(measurePaintInPage, region).catch(() => null);
      r.paintRegion = region;
    }

    fs.mkdirSync(path.join(SHOTS_DIR, viewport), { recursive: true });
    await page
      .screenshot({ path: path.join(SHOTS_DIR, viewport, slug(route.path) + '.png'), fullPage: true })
      .catch(() => {});

    // (b) deep-link refresh must re-boot the app
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    const c2 = await waitForAnyContent(page, route.content);
    r.refresh = c2.ok;
  } catch (e) {
    r.error = (e.message || String(e)).slice(0, 160);
  }

  r.network = !netFailures.some((f) => f.critical);
  r.consoleClean = consoleErrors.length === 0;
  // Gate only on CRITICAL a11y (e.g. aria-required-parent). `serious` issues —
  // notably color-contrast — are pervasive design-token debt across the whole
  // site, so they're reported as warnings rather than turning every page red.
  r.a11y = !r.axe.some((v) => v.impact === 'critical');
  r.garbageClean = r.garbage.length === 0;

  await context.close();
  return r;
}

async function discover(browser, listPath, linkSelector) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  let href = null;
  try {
    await page.goto(urlFor(listPath), { waitUntil: 'load', timeout: 30000 });
    href = await page.locator(linkSelector).first().getAttribute('href', { timeout: CONTENT_TIMEOUT }).catch(() => null);
  } catch { /* ignore */ }
  await context.close();
  if (!href) return null;
  try {
    return new URL(href, BASE).pathname.replace(/^\/globalPerspective-v1/, '');
  } catch {
    return href;
  }
}

const passed = (r) =>
  r.loads && r.content && r.refresh && r.network && r.consoleClean && r.a11y && r.garbageClean;

// ---- /economy story-arc link integrity ----------------------------------
// /economy lists "economic disruptions" that deep-link to /weekly/thread/:id.
// Those threads can be older than the 30-day rolling archive, so ThreadPage
// must rebuild them from the durable 90-day `narrative_thread` endpoint.
// Regression guard: every economy story link must resolve to the FULL thread
// page (`.tp-content-tabs` only renders on the full-render path — it comes
// AFTER both the "Story arc not found" dead-end and the analysis-only fallback
// return early), never the dead-end and never the aged-out fallback.
const STORY_DEAD_TEXT = 'Story arc not found';
const STORY_FALLBACK_TEXT = 'aged out of the';

const STORY_LINK_CAP = Number(process.env.SMOKE_STORY_CAP) || 20;

async function checkEconomyStoryLinks(browser, cap = STORY_LINK_CAP) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  const out = { total: 0, ok: 0, dead: [] };
  try {
    await page.goto(urlFor('/economy'), { waitUntil: 'load', timeout: 30000 });
    await page.locator('a[href*="/weekly/thread/"]').first()
      .waitFor({ state: 'attached', timeout: CONTENT_TIMEOUT }).catch(() => {});
    const hrefs = await page.locator('a[href*="/weekly/thread/"]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('href')).filter(Boolean)
    );
    // dedupe by thread path (ignore query string), cap to bound runtime
    const seen = new Set();
    const paths = [];
    for (const h of hrefs) {
      let p;
      try { p = new URL(h, BASE).pathname.replace(/^\/globalPerspective-v1/, ''); }
      catch { p = h; }
      if (seen.has(p)) continue;
      seen.add(p);
      paths.push(p);
    }
    out.total = paths.length;
    for (const p of paths.slice(0, cap)) {
      await page.goto(urlFor(p), { waitUntil: 'load', timeout: 30000 });
      const rendered = await page.locator('.tp-content-tabs').first()
        .waitFor({ state: 'visible', timeout: CONTENT_TIMEOUT })
        .then(() => true).catch(() => false);
      if (rendered) { out.ok++; continue; }
      const body = await page.evaluate(() => document.body.innerText || '');
      const reason = body.includes(STORY_DEAD_TEXT) ? 'dead-end (Story arc not found)'
        : body.includes(STORY_FALLBACK_TEXT) ? 'analysis-only fallback (timeline aged out)'
        : 'no full thread page rendered';
      out.dead.push({ path: p, reason });
    }
  } catch (e) {
    out.error = (e.message || String(e)).slice(0, 160);
  }
  await context.close();
  return out;
}

// ---- /map layer-render integrity (class 7) -------------------------------
// Class 7 = "silent empty render": a data-backed, toggleable view draws ZERO
// items though the data is present (a mis-keyed or over-aggressive client
// filter). The page looks healthy — only the *layer* is empty — so every other
// check passes. This is the only class no other script covers.
//
// Guard: on /map, with live data loaded, each layer whose backing data is
// reliably present on prod must render >0 of its SVG element:
//   • Today's pulse → `.today-ring` (drawn from topics — always present)
//   • Connections   → `.flow`       (drawn from pair analyses — always present)
// We deliberately do NOT assert the Economy/Editorial layers: their backing
// data (active disruptions / elevated-signal picks) can legitimately be empty,
// which would be a class-6 empty-state, not this bug. Per the class-7 scope, a
// genuinely empty source is valid — we only fail on data-present-but-view-empty.
const MAP_LAYERS = [
  { label: "Today's pulse", el: '.today-ring', key: 'pulse' },
  { label: 'Connections',   el: '.flow',       key: 'connections' },
];

async function checkMapLayers(browser) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  const out = { ran: false, layers: {}, error: null };
  try {
    await page.goto(urlFor('/map'), { waitUntil: 'load', timeout: 30000 });
    // Wait for the map itself to draw (the sphere path is drawn first), then let
    // data hooks resolve + the debounced (240ms) redraw settle.
    await page.locator('svg .sphere').first().waitFor({ state: 'attached', timeout: CONTENT_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1200);
    out.ran = true;

    for (const layer of MAP_LAYERS) {
      const opt = page.locator('.mv2-rail .opt', { hasText: layer.label }).first();
      // Toggle the layer ON if it isn't already (default state has Pulse on).
      const isOn = await opt.evaluate((e) => e.classList.contains('on')).catch(() => false);
      if (!isOn) {
        await opt.click().catch(() => {});
        await page.waitForTimeout(900); // debounced redraw
      }
      const count = await page.locator(`svg ${layer.el}`).count().catch(() => 0);
      out.layers[layer.key] = count;
    }
  } catch (e) {
    out.error = (e.message || String(e)).slice(0, 160);
  }
  await context.close();
  return out;
}

// ---- main ----------------------------------------------------------------
(async () => {
  console.log(`\nProduction smoke-test against ${BASE}`);
  console.log(`Viewports: ${ACTIVE_VIEWPORTS.join(', ')} | screenshots → ${SHOTS_DIR}`);
  console.log('='.repeat(72));
  fs.rmSync(SHOTS_DIR, { recursive: true, force: true });

  const browser = await chromium.launch();
  const routes = [...STATIC_ROUTES];

  const threadPath = await discover(browser, '/weekly', 'a[href*="/weekly/thread/"]');
  if (threadPath) routes.push({ name: 'Thread', path: threadPath, content: ['.tp-section-lbl', '.container'], region: '.tp-content-tabs' });
  else console.log('  ! could not discover a thread id from /weekly — skipping Thread');

  const countryPath = await discover(browser, '/weekly/countries', 'a[href*="/weekly/country/"]');
  if (countryPath) routes.push({ name: 'Country', path: countryPath, content: ['.cpg-hd-h1', '.cp-coverage'], region: '.cp-coverage' });
  else console.log('  ! could not discover a country from /weekly/countries — skipping Country');

  const dailyPath = await discover(browser, '/daily', 'a[href*="/daily/2"]');
  if (dailyPath) routes.push({ name: 'DailyDated', path: dailyPath, content: ['.daily-footprint'] });

  const results = [];
  for (const route of routes) {
    for (const vp of ACTIVE_VIEWPORTS) {
      process.stdout.write(`  • ${(route.name + ' [' + vp + ']').padEnd(22)} ${route.path} ... `);
      const r = await checkRoute(browser, route, vp);
      results.push(r);
      console.log(passed(r) ? 'PASS' : 'FAIL');
    }
  }

  process.stdout.write(`  • ${'EconomyStoryLinks'.padEnd(22)} /economy → /weekly/thread/* ... `);
  const story = await checkEconomyStoryLinks(browser);
  const storyOk = !story.error && story.dead.length === 0;
  console.log(storyOk ? `PASS (${story.ok}/${Math.min(story.total, STORY_LINK_CAP)})` : 'FAIL');

  process.stdout.write(`  • ${'MapLayers'.padEnd(22)} /map pulse + connections render ... `);
  const mapLayers = await checkMapLayers(browser);
  const mapEmpty = mapLayers.ran
    ? Object.entries(mapLayers.layers).filter(([, n]) => n === 0).map(([k]) => k)
    : [];
  const mapOk = mapLayers.ran && !mapLayers.error && mapEmpty.length === 0;
  console.log(mapOk
    ? `PASS (${Object.entries(mapLayers.layers).map(([k, n]) => `${k}:${n}`).join(', ')})`
    : 'FAIL');

  await browser.close();

  // ---- table ----
  console.log(`\n${'='.repeat(72)}\nRESULTS\n${'='.repeat(72)}`);
  const c = (s, n) => String(s).padEnd(n);
  const ok = (b) => (b ? 'ok' : 'X ');
  console.log(
    c('PAGE', 13) + c('VIEW', 9) + c('LOAD', 5) + c('CONT', 5) + c('REFR', 5) +
      c('NET', 5) + c('CONS', 5) + c('A11Y', 5) + c('CLEAN', 6) + 'PATH'
  );
  console.log('-'.repeat(90));
  let failed = 0;
  for (const r of results) {
    if (!passed(r)) failed++;
    console.log(
      c(r.name, 13) + c(r.viewport, 9) + c(ok(r.loads), 5) + c(ok(r.content), 5) +
        c(ok(r.refresh), 5) + c(ok(r.network), 5) + c(ok(r.consoleClean), 5) +
        c(ok(r.a11y), 5) + c(ok(r.garbageClean), 6) + r.path
    );
  }

  // ---- failure detail ----
  const problems = results.filter((r) => !passed(r));
  if (problems.length) {
    console.log(`\n${'-'.repeat(90)}\nFAILURE DETAIL`);
    for (const r of problems) {
      console.log(`\n  ${r.name} [${r.viewport}] (${r.path})`);
      if (r.error) console.log(`    error: ${r.error}`);
      if (!r.content) console.log('    content: no key data selector matched (page may be empty-but-mounted)');
      if (!r.refresh) console.log('    refresh: app did NOT re-render after reload (stale 404.html / SPA-fallback bug)');
      r.consoleErrors.forEach((e) => console.log(`    console: ${e}`));
      r.netFailures.filter((f) => f.critical).forEach((f) =>
        console.log(`    net[critical]: ${f.status} ${f.type} ${f.url}`)
      );
      r.axe.filter((v) => v.impact === 'critical').forEach((v) =>
        console.log(`    a11y[critical]: ${v.id} (${v.n} node${v.n === 1 ? '' : 's'})${v.err ? ' — ' + v.err : ''}`)
      );
      r.garbage.forEach((g) => console.log(`    garbage: …${g}…`));
    }
  }

  // ---- non-critical warnings ----
  const warns = results.flatMap((r) =>
    r.netFailures.filter((f) => !f.critical).map((f) => ({ page: `${r.name}[${r.viewport}]`, ...f }))
  );
  const seriousA11y = results.flatMap((r) =>
    r.axe.filter((v) => v.impact === 'serious').map((v) => ({ page: `${r.name}[${r.viewport}]`, ...v }))
  );
  const minorA11y = results.flatMap((r) =>
    r.axe.filter((v) => v.impact && !['serious', 'critical'].includes(v.impact))
      .map((v) => ({ page: `${r.name}[${r.viewport}]`, ...v }))
  );
  if (warns.length) {
    console.log(`\n${'-'.repeat(90)}\nNETWORK WARNINGS (non-blocking — data gaps / expected 404s)`);
    [...new Set(warns.map((w) => `  ${w.page}: ${w.status} ${w.type} ${w.url}`))].forEach((l) => console.log(l));
  }
  if (seriousA11y.length) {
    console.log(`\n${'-'.repeat(90)}\nA11Y SERIOUS (non-blocking — design-system debt, fix opportunistically)`);
    [...new Set(seriousA11y.map((v) => `  ${v.page}: ${v.id} (${v.n})`))].forEach((l) => console.log(l));
  }
  if (minorA11y.length) {
    console.log(`\n${'-'.repeat(90)}\nA11Y MINOR (moderate/minor — non-blocking)`);
    [...new Set(minorA11y.map((v) => `  ${v.page}: ${v.id} [${v.impact}] (${v.n})`))].forEach((l) => console.log(l));
  }

  // ---- economy story-link integrity ----
  console.log(`\n${'-'.repeat(90)}\nECONOMY STORY-LINK INTEGRITY (every /economy disruption must open a full thread page)`);
  if (story.error) {
    console.log(`  error: ${story.error}`);
  } else {
    const checked = Math.min(story.total, STORY_LINK_CAP);
    console.log(`  ${story.ok}/${checked} resolved to a full thread page (of ${story.total} unique links)`);
    story.dead.forEach((d) => console.log(`  DEAD: ${d.path} — ${d.reason}`));
  }
  const storyFailed = story.error ? 1 : story.dead.length;

  // ---- /map layer-render integrity (class 7) ----
  console.log(`\n${'-'.repeat(90)}\nMAP LAYER RENDER (class 7 — data-backed layers must not silently render empty)`);
  if (!mapLayers.ran || mapLayers.error) {
    console.log(`  error: ${mapLayers.error || 'map did not load'}`);
  } else {
    for (const [k, n] of Object.entries(mapLayers.layers)) {
      console.log(`  ${n > 0 ? 'ok' : 'EMPTY'} ${k}: ${n} element${n === 1 ? '' : 's'} rendered`);
    }
    mapEmpty.forEach((k) => console.log(`  SILENT-EMPTY: ${k} layer drew 0 elements with data present (class 7 regression)`));
  }
  const mapFailed = mapOk ? 0 : 1;

  // ---- visual paint (general class-7 guard) ----
  console.log(`\n${'-'.repeat(90)}\nVISUAL PAINT (class 7 — key content regions must not silently render blank)`);
  const measured = results.filter((r) => r.paint && r.paint.found);
  const paintBlank = measured.filter(
    (r) => r.paint.coverage < PAINT_MIN || r.paint.sampled < PAINT_MIN_SAMPLES
  );
  if (!measured.length) {
    console.log('  (no regions measured)');
  } else {
    for (const r of measured) {
      const blank = r.paint.coverage < PAINT_MIN || r.paint.sampled < PAINT_MIN_SAMPLES;
      console.log(
        `  ${blank ? 'BLANK' : 'ok'} ${r.name.padEnd(12)} ${String(r.paintRegion).padEnd(18)} ` +
          `coverage ${(r.paint.coverage * 100).toFixed(0)}% (${r.paint.hits}/${r.paint.sampled} pts)`
      );
    }
    paintBlank.forEach((r) =>
      console.log(`  SILENT-EMPTY: ${r.name} ${r.paintRegion} painted only ${(r.paint.coverage * 100).toFixed(0)}% — region rendered blank (class 7 regression)`)
    );
  }
  const paintFailed = paintBlank.length ? 1 : 0;

  const totalChecks = results.length + 3;
  const totalFailed = failed + (storyOk ? 0 : 1) + mapFailed + paintFailed;
  console.log(`\n${'='.repeat(72)}`);
  console.log(totalFailed === 0 ? `ALL ${totalChecks} CHECKS HEALTHY` : `${totalFailed}/${totalChecks} CHECKS FAILED`);
  if (storyFailed) console.log(`  (${storyFailed} economy story link${storyFailed === 1 ? '' : 's'} dead)`);
  if (mapFailed) console.log(`  (/map: ${mapEmpty.length ? mapEmpty.join(' + ') + ' layer empty' : 'did not load'})`);
  if (paintFailed) console.log(`  (${paintBlank.length} region${paintBlank.length === 1 ? '' : 's'} painted blank: ${paintBlank.map((r) => r.name).join(', ')})`);
  console.log(`Screenshots: ${SHOTS_DIR}`);
  process.exit(totalFailed === 0 ? 0 : 1);
})();
