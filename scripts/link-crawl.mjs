#!/usr/bin/env node
/**
 * Site-wide link-integrity crawler (the generalization of the /economy
 * story-arc bug). From each "hub" page it collects every internal link, then
 * visits each destination and decides HEALTHY / DEGRADED / DEAD by inspecting
 * the client-rendered DOM (this is an SPA — HTTP status is always 200/404.html,
 * so "dead" must be judged from rendered text, not the status code).
 *
 * Usage: node scripts/link-crawl.mjs
 *        SMOKE_BASE=https://globalperspective.net node scripts/link-crawl.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FE = path.join(__dir, '../global-perspectives-starter/frontend');
const { chromium } = await import(path.join(FE, 'node_modules/playwright/index.mjs'));

const BASE = (process.env.SMOKE_BASE || 'https://globalperspective.net').replace(/\/$/, '');
const T = 15000;

// Hub pages = aggregate/index pages that link OUT to detail entities. Depth-1
// crawl from these covers the "aggregate → detail across a rolling window"
// dangling-reference class everywhere it can occur.
const HUBS = [
  '/', '/economy', '/weekly', '/weekly/countries',
  '/daily', '/map', '/about', '/contact', '/privacy', '/disclosures', '/whitepaper',
];

// Hard dead-ends: the user landed somewhere broken.
const DEAD_PATTERNS = [
  /Page not found/i,
  /That URL doesn't lead anywhere/i,
  /Story arc not found/i,
  /This thread may have expired/i,
  /No brief available/i,
  /No brief found for/i,
  /Something went wrong/i,
];
// Degraded: page renders, but the primary content was unavailable (a softer
// failure worth surfacing — e.g. a thread whose timeline aged past 90 days).
const DEGRADED_PATTERNS = [
  /aged out of the \d+-day window/i,
];

const urlFor = (p) => BASE + p;

function isInternal(href) {
  if (!href) return false;
  if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return false;
  if (/^https?:\/\//i.test(href)) return href.startsWith(BASE);
  return href.startsWith('/');
}
function toPath(href) {
  try { return new URL(href, BASE).pathname.replace(/^\/globalPerspective-v1/, '') + (new URL(href, BASE).search || ''); }
  catch { return href; }
}

async function collectLinks(page, hub) {
  await page.goto(urlFor(hub), { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => document.getElementById('root')?.children.length > 0 && document.body.innerText.trim().length > 30,
    { timeout: T }
  ).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  const hrefs = await page.locator('a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  return hrefs.filter(isInternal).map(toPath);
}

async function classify(page, p) {
  try {
    await page.goto(urlFor(p), { waitUntil: 'load', timeout: 30000 });
    const mounted = await page.waitForFunction(
      () => document.getElementById('root')?.children.length > 0,
      { timeout: T }
    ).then(() => true).catch(() => false);
    if (!mounted) return { state: 'DEAD', reason: 'root never mounted (blank)' };
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const text = await page.evaluate(() => document.body.innerText || '');
    for (const re of DEAD_PATTERNS) if (re.test(text)) return { state: 'DEAD', reason: re.source };
    for (const re of DEGRADED_PATTERNS) if (re.test(text)) return { state: 'DEGRADED', reason: re.source };
    if (text.trim().length < 50) return { state: 'DEAD', reason: 'mounted but near-empty body' };
    return { state: 'HEALTHY', reason: '' };
  } catch (e) {
    return { state: 'DEAD', reason: 'nav error: ' + (e.message || '').slice(0, 80) };
  }
}

(async () => {
  console.log(`\nLink-integrity crawl against ${BASE}`);
  console.log('='.repeat(72));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // depth-1: collect every internal link off each hub
  const linkedFrom = new Map(); // destPath -> Set(hubs)
  for (const hub of HUBS) {
    process.stdout.write(`  collecting links from ${hub} ... `);
    let links = [];
    try { links = await collectLinks(page, hub); } catch { /* ignore */ }
    const uniq = [...new Set(links)];
    for (const l of uniq) {
      if (!linkedFrom.has(l)) linkedFrom.set(l, new Set());
      linkedFrom.get(l).add(hub);
    }
    console.log(`${uniq.length} links`);
  }

  const dests = [...linkedFrom.keys()].filter((p) => !HUBS.includes(p)).sort();
  console.log(`\nVisiting ${dests.length} unique linked destinations...\n`);

  const dead = [], degraded = [];
  let healthy = 0;
  for (const p of dests) {
    const r = await classify(page, p);
    if (r.state === 'HEALTHY') { healthy++; continue; }
    const rec = { path: p, reason: r.reason, from: [...linkedFrom.get(p)] };
    if (r.state === 'DEAD') { dead.push(rec); process.stdout.write('X'); }
    else { degraded.push(rec); process.stdout.write('!'); }
  }
  process.stdout.write('\n');

  await browser.close();

  console.log(`\n${'='.repeat(72)}`);
  console.log(`HEALTHY ${healthy}  ·  DEGRADED ${degraded.length}  ·  DEAD ${dead.length}  (of ${dests.length})`);
  if (dead.length) {
    console.log(`\nDEAD LINKS:`);
    for (const d of dead) console.log(`  X ${d.path}\n      reason: ${d.reason}\n      linked from: ${d.from.join(', ')}`);
  }
  if (degraded.length) {
    console.log(`\nDEGRADED (renders, primary content unavailable):`);
    for (const d of degraded) console.log(`  ! ${d.path}\n      reason: ${d.reason}\n      linked from: ${d.from.join(', ')}`);
  }
  console.log('');
  process.exit(dead.length ? 1 : 0);
})();
