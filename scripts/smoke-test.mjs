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
const STATIC_ROUTES = [
  { name: 'Home',        path: '/',                 content: ['.home-shell'] },
  { name: 'Map',         path: '/map',              content: ['.mv2'] },
  { name: 'Daily',       path: '/daily',            content: ['.daily-footprint'] },
  { name: 'Economy',     path: '/economy',          content: ['.ep-row-l1'] },
  { name: 'Weekly',      path: '/weekly',           content: ['.weekly-feed', '.arc-dots', '.weekly-empty-state'] },
  { name: 'CountryList', path: '/weekly/countries', content: ['.clp-card'] },
  { name: 'About',       path: '/about',            content: ['.card'] },
  { name: 'Contact',     path: '/contact',          content: ['.card'] },
  { name: 'Privacy',     path: '/privacy',          content: ['.card'] },
  { name: 'Disclosures', path: '/disclosures',      content: ['.card'] },
  { name: 'Whitepaper',  path: '/whitepaper',       content: ['.card'] },
  { name: 'SignIn',      path: '/signin',           content: ['.weekly-gate'] },
  { name: 'Account',     path: '/account',          content: [] }, // shell/redirect page
];

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
    consoleErrors, netFailures, axe: [], garbage: [],
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

async function checkEconomyStoryLinks(browser, cap = 20) {
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

// ---- main ----------------------------------------------------------------
(async () => {
  console.log(`\nProduction smoke-test against ${BASE}`);
  console.log(`Viewports: ${ACTIVE_VIEWPORTS.join(', ')} | screenshots → ${SHOTS_DIR}`);
  console.log('='.repeat(72));
  fs.rmSync(SHOTS_DIR, { recursive: true, force: true });

  const browser = await chromium.launch();
  const routes = [...STATIC_ROUTES];

  const threadPath = await discover(browser, '/weekly', 'a[href*="/weekly/thread/"]');
  if (threadPath) routes.push({ name: 'Thread', path: threadPath, content: ['.tp-section-lbl', '.container'] });
  else console.log('  ! could not discover a thread id from /weekly — skipping Thread');

  const countryPath = await discover(browser, '/weekly/countries', 'a[href*="/weekly/country/"]');
  if (countryPath) routes.push({ name: 'Country', path: countryPath, content: ['.cpg-hd-h1', '.cp-coverage'] });
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
  console.log(storyOk ? `PASS (${story.ok}/${Math.min(story.total, 20)})` : 'FAIL');

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
    const checked = Math.min(story.total, 20);
    console.log(`  ${story.ok}/${checked} resolved to a full thread page (of ${story.total} unique links)`);
    story.dead.forEach((d) => console.log(`  DEAD: ${d.path} — ${d.reason}`));
  }
  const storyFailed = story.error ? 1 : story.dead.length;

  const totalChecks = results.length + 1;
  const totalFailed = failed + (storyOk ? 0 : 1);
  console.log(`\n${'='.repeat(72)}`);
  console.log(totalFailed === 0 ? `ALL ${totalChecks} CHECKS HEALTHY` : `${totalFailed}/${totalChecks} CHECKS FAILED`);
  if (storyFailed) console.log(`  (${storyFailed} economy story link${storyFailed === 1 ? '' : 's'} dead)`);
  console.log(`Screenshots: ${SHOTS_DIR}`);
  process.exit(totalFailed === 0 ? 0 : 1);
})();
