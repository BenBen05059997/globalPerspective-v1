'use strict';
// Local script: GET the real public views for three stories, build the card data, write PNGs (full size and 360 px wide) and SVGs.
//   node test/renderStoryCards.js [outDir]        (outDir defaults to .board/reviews/story-card-2026-11-21/card-build/)
// Plain GETs under https://globalperspective.net/data/ only. No AWS, no sign-in. sharp comes from this lane's node_modules when it
// has one, else from the front end's (local run only; the Lambda zip carries its own).
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { storyCardFor, siteDataReader } = require('../src/storyCardPost');
const { buildStoryCardSvg, renderStoryCardPng, planMap } = require('../src/storyCardImage');

const REPO = path.resolve(__dirname, '../../../..');
const OUT = path.resolve(process.argv[2] || path.join(REPO, '.board/reviews/story-card-2026-11-21/card-build'));

const EXAMPLES = [
  { name: 'card-near-link-houthi', id: 'thread-houthi-attacks-on-saudi-arabia-ed2d26' },
  { name: 'card-far-link-bahrain', id: 'thread-iran-strikes-us-base-in-bahrai-6ba80b' },
  { name: 'card-no-link-poland', id: 'thread-russian-missiles-hit-poland-ne-021311' },
  { name: 'card-extra-gulf-oil', id: 'thread-iaea-says-cannot-verify-iran-s-c660a5' }, // a far main country (JPN) next to a Gulf link
];

function loadSharp() {
  try { return require('sharp'); } catch { return createRequire(path.join(REPO, 'global-perspectives-starter/frontend/package.json'))('sharp'); }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const sharp = loadSharp();
  const today = new Date().toISOString().slice(0, 10);
  const read = siteDataReader('https://globalperspective.net/');
  for (const ex of EXAMPLES) {
    // the poster's own path (storyCardPost): same views, same same-places rule
    const data = await storyCardFor(ex.id, { get: read, today });
    if (!data) { console.log(`${ex.name}: no story view`); continue; }
    fs.writeFileSync(path.join(OUT, `${ex.name}.json`), `${JSON.stringify(data, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, `${ex.name}.svg`), buildStoryCardSvg(data));
    const plan = planMap(data);
    for (const width of [1200, 360]) {
      const png = await renderStoryCardPng(data, { width, sharp });
      fs.writeFileSync(path.join(OUT, `${ex.name}-${width}.png`), png);
    }
    if (plan.arrowFault) console.log(`  ARROW FAULT: ${plan.arrowFault}`);
    console.log(`${ex.name}: ${data.link ? `${data.link.direction} ${data.link.strength} link` : data.forecast ? `forecast ${data.forecast.chance}%` : 'nothing focal'}; countries ${data.countries.join(',')}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
