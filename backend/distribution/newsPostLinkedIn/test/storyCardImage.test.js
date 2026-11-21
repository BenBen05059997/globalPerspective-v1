'use strict';
// storyCardImage / storyCardData / storyCardGeo / fontMetrics: the pure parts of the story card picture. Offline, no sharp except the one
// PNG test, which skips when sharp cannot be loaded.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildStoryCardSvg, renderStoryCardPng, planMap, crisisOf, fmtDate, sinceLine } = require('../src/storyCardImage');
const { pickLinkLine, pickForecast, placeCountries, storyCardData } = require('../src/storyCardData');
const { countryShape, insideShape } = require('../src/storyCardGeo');
const { wrapText, textWidth } = require('../src/fontMetrics');

const BASE = {
  headline: 'Saudi-Led Coalition Launches Special Operation on Yemen',
  kind: 'move', category: 'conflict', newestDate: '2026-11-20', firstDate: '2026-09-08', stepCount: 64, stepDays: 37,
  countries: ['SAU', 'YEM'], sourceCount: 7,
};
const LINK = { direction: 'feeds', strength: 'medium', confirmed: true, title: 'Egypt Parliament Approves Military Support', category: 'military', countries: ['EGY', 'SAU', 'YEM'] };
const FORECAST = { chance: 22, text: 'Poland formally invokes Article 4', due: '2026-12-20' };

test('small helpers: date, since line, crisis type', () => {
  assert.equal(fmtDate('2026-11-20'), 'Nov 20');
  assert.equal(fmtDate('2026-09-08T10:00:00Z'), 'Sep 8');
  assert.equal(fmtDate('nope'), '');
  assert.equal(sinceLine({ stepCount: 64, stepDays: 37 }), '64 steps on 37 days');
  assert.equal(sinceLine({ stepCount: 2, stepDays: 1 }), '2 steps on 1 day');
  assert.equal(sinceLine({ stepCount: 1, kind: 'start' }), 'first step of a new story');
  assert.equal(sinceLine({}), '');
  assert.equal(crisisOf('energy'), 'economic');
  assert.equal(crisisOf('Military'), 'conflict');
  assert.equal(crisisOf('technology'), 'neutral');
});

test('fontMetrics: wrap stops at the line count and ends with an ellipsis', () => {
  const long = 'word '.repeat(80);
  const { lines, clipped } = wrapText(long, { size: 34, weight: 600, maxWidth: 600, maxLines: 4 });
  assert.equal(lines.length, 4);
  assert.equal(clipped, true);
  assert.ok(lines[3].endsWith('…'));
  for (const l of lines) assert.ok(textWidth(l, 34, 600) <= 600);
  assert.deepEqual(wrapText('Short', { size: 34, maxWidth: 600, maxLines: 4 }), { lines: ['Short'], clipped: false });
});

test('pickLinkLine: medium or strong judged links only; a confirmed pair first; direction from from/to', () => {
  const views = [{
    confirmedLinks: [{ otherThreadId: 'B', direction: 'driven_by' }],
    judgedLinks: [
      { from: 'A', to: 'W', otherTitle: 'weak', confidence: 'weak', generatedAt: '2026-11-20' },
      { from: 'A', to: 'S', otherTitle: 'strong not confirmed', confidence: 'strong', generatedAt: '2026-11-20' },
      { from: 'B', to: 'A', otherTitle: 'medium confirmed', confidence: 'medium', generatedAt: '2026-11-19' },
    ],
  }];
  assert.deepEqual(pickLinkLine(['A'], views), { dir: 'fed', otherId: 'B', title: 'medium confirmed', strength: 'medium', confirmed: true });
  assert.equal(pickLinkLine(['A'], [{ judgedLinks: [{ from: 'A', to: 'W', confidence: 'weak' }] }]), null);
  assert.equal(pickLinkLine(['A'], [{ confirmedLinks: [{ otherThreadId: 'B' }], judgedLinks: [] }]), null);
  // links on a merged-away record count for the story that absorbed it
  assert.equal(pickLinkLine(['A', 'OLD'], [null, { judgedLinks: [{ from: 'OLD', to: 'X', otherTitle: 'x', confidence: 'medium' }] }]).dir, 'feeds');
});

test('pickForecast: open question due soonest with its own chance; past, settled and "Will" questions skipped', () => {
  const b = (n, p, due, extra = {}) => ({ branchId: `PRED#T-0/2026-11-20/${n}-0`, trigger: `Thing ${n} happens`, p, due, question: true, qid: `q${n}`, ...extra });
  const view = { forks: [
    { drawnAt: '2026-11-19', branches: [b(0, 90, '2026-12-01')] },
    { drawnAt: '2026-11-20', branches: [b(0, 35, '2027-01-31'), b(1, 22, '2026-12-20'), b(2, 50, '2026-12-20'), b(3, 80, '2026-11-01'), b(4, 70, '2026-12-05', { state: 'yes' }), b(5, 60, '2026-12-06', { trigger: 'Will it rain' })] },
  ] };
  assert.deepEqual(pickForecast(view, '2026-11-21'), { chance: 50, text: 'Thing 2 happens', due: '2026-12-20' });
  assert.equal(pickForecast({ forks: [] }, '2026-11-21'), null);
});

test('placeCountries: a story-keyed situation orders and filters the step countries; otherwise the step list stands', () => {
  const step = { iso3: ['POL', 'RUS', 'UKR'] };
  const sit = [{ id: 'news#POL#thread-p', threadId: 'thread-p', iso3_affected: ['POL', 'RUS'] }, { id: 'news#conflict#POL#polish', threadId: 'thread-p', iso3_affected: ['POL', 'UKR'] }];
  assert.deepEqual(placeCountries(step, sit, ['thread-p']), { countries: ['POL', 'RUS'], context: ['UKR'], source: 'situation' });
  assert.deepEqual(placeCountries(step, [], ['thread-p']), { countries: ['POL', 'RUS', 'UKR'], context: [], source: 'step' });
  assert.deepEqual(placeCountries({ iso3: ['BHR', 'IRN', 'USA'] }, sit, ['other']).countries, ['BHR', 'IRN', 'USA']);
});

test('storyCardData: the link wins over the forecast; no link keeps the forecast', () => {
  const story = { threadId: 'A', title: 'T', category: 'conflict', newestStep: { role: 'move', date: '2026-11-20', sourceCount: 3 }, firstStep: { date: '2026-09-08' }, stepCount: 2, stepDays: 1, entries: [{ iso3: ['SAU'] }], merges: [],
    forks: [{ drawnAt: '2026-11-20', branches: [{ branchId: 'PRED#T-0/2026-11-20/0-0', trigger: 'It happens', p: 40, due: '2099-01-01', question: true, qid: 'q' }] }] };
  const links = { judgedLinks: [{ from: 'A', to: 'B', otherTitle: 'Other', confidence: 'strong' }] };
  const other = { title: 'Other', category: 'energy', entries: [{ iso3: ['JPN', 'SAU'] }] };
  const withLink = storyCardData({ story, linkViews: [links], otherStory: other, today: '2026-11-21' });
  assert.equal(withLink.link.direction, 'feeds');
  assert.deepEqual(withLink.link.countries, ['JPN', 'SAU']);
  assert.equal(withLink.forecast, null);
  const noLink = storyCardData({ story, linkViews: [], today: '2026-11-21' });
  assert.equal(noLink.link, null);
  assert.deepEqual(noLink.forecast, { chance: 40, text: 'It happens', due: '2099-01-01' });
});

test('planMap: striped = the other story\'s new countries (at most two); none new means no arrow and "the same places"', () => {
  const p = planMap({ ...BASE, link: LINK });
  assert.deepEqual(p.striped.map((s) => s.iso3), ['EGY']);
  assert.deepEqual(p.placeNames, ['Egypt']);
  const same = planMap({ ...BASE, link: { ...LINK, countries: ['SAU', 'YEM'] } });
  assert.deepEqual(same.striped, []);
  assert.deepEqual(same.placeNames, []);
  const many = planMap({ ...BASE, countries: ['SAU'], link: { ...LINK, countries: ['EGY', 'JOR', 'IRQ', 'SAU'] } });
  assert.deepEqual(many.placeNames, ['Egypt', 'Jordan']);
});

test('planMap: far actors fall off the map into a note; the frame holds every drawn country with a margin and cuts none', () => {
  const p = planMap({ ...BASE, countries: ['BHR', 'IRN', 'USA'], link: { ...LINK, countries: ['JPN', 'SAU'] } });
  assert.deepEqual(p.own.map((s) => s.iso3), ['BHR', 'IRN']);
  assert.deepEqual(p.notes, ['United States']);
  assert.deepEqual(p.striped.map((s) => s.iso3), ['JPN', 'SAU']);
  const f = p.frame;
  assert.ok(f.w * f.scale > 503 && f.w * f.scale < 505, 'frame fills the panel width');
  for (const s of [...p.own, ...p.striped]) {
    const pad = 0.04 * f.w; // a margin on every side
    assert.ok(s.box[0] - pad >= f.x && s.box[2] + pad <= f.x + f.w, `${s.iso3} inside horizontally`);
    assert.ok(s.box[1] - pad >= f.y && s.box[3] + pad <= f.y + f.h, `${s.iso3} inside vertically`);
  }
  assert.ok(p.dotted.has('BHR'), 'a country with no outline is a dot');
});

test('planMap: countries under 20 px (6 px at 360) become dots', () => {
  const p = planMap({ ...BASE, countries: ['IRN'], link: { ...LINK, countries: ['JPN'] } });
  for (const s of [...p.own, ...p.striped]) {
    const px = Math.max(s.box[2] - s.box[0], s.box[3] - s.box[1]) * p.frame.scale;
    assert.equal(p.dotted.has(s.iso3), px < 20, s.iso3);
  }
});

test('geo: outlines hold their own points, the date line does not stretch Russia or Fiji', () => {
  const pol = countryShape('POL');
  assert.ok(insideShape(pol, pol.anchor[0], pol.anchor[1]));
  assert.equal(countryShape('XXX'), null);
  assert.equal(countryShape('BHR').kind, 'point');
  const fji = countryShape('FJI');
  assert.ok(fji.box[2] - fji.box[0] < 40);
});

test('svg: link leads; the forecast shows only without a link; no cyan; every word at least 30 px', () => {
  const link = buildStoryCardSvg({ ...BASE, link: LINK, forecast: FORECAST });
  assert.ok(link.includes('Feeds into'.toUpperCase()));
  assert.ok(!link.includes('OUR FORECAST'));
  const fc = buildStoryCardSvg({ ...BASE, forecast: FORECAST });
  assert.ok(fc.includes('OUR FORECAST') && fc.includes('22%') && fc.includes('by Dec 20'));
  for (const svg of [link, fc]) {
    assert.ok(!/#5fd4ff|#00e5ff|cyan/i.test(svg));
    const sizes = [...svg.matchAll(/<text [^>]*font-size="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
    assert.ok(sizes.length > 8);
    assert.ok(Math.min(...sizes) >= 30, `smallest text ${Math.min(...sizes)}`);
  }
});

test('svg: headline stops at four lines with an ellipsis; amber only on the newest-step dot and words', () => {
  const svg = buildStoryCardSvg({ ...BASE, headline: 'A very long headline '.repeat(30), forecast: FORECAST });
  const head = [...svg.matchAll(/<text [^>]*font-weight="600"[^>]*fill="#f1f4f6"[^>]*>([^<]*)</g)].map((m) => m[1]);
  assert.ok(head.some((l) => l.endsWith('…')));
  assert.ok(head.length <= 5);
  const amber = [...svg.matchAll(/<(\w+)[^>]*#ffb347[^>]*>([^<]*)/g)].map((m) => m[1] + ':' + m[2]);
  assert.ok(amber.every((a) => /^(circle|text:(Nov 20|NEWEST STEP))/.test(a)), amber.join('|'));
  const old = buildStoryCardSvg({ ...BASE, newestDate: '', forecast: FORECAST });
  assert.ok(!old.includes('#ffb347'), 'no newest date, no amber');
});

test('svg: arrow runs from the feeding story to the fed one', () => {
  const tailHead = (data) => {
    const svg = buildStoryCardSvg(data);
    const tail = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="9"/);
    const tip = svg.match(/<polygon points="([\d.]+),([\d.]+) /);
    return { tail: Number(tail[1]), tip: Number(tip[1]) };
  };
  const base = { ...BASE, countries: ['IRN'], link: { ...LINK, countries: ['JPN'] } };
  const feeds = tailHead(base);
  assert.ok(feeds.tail < feeds.tip, 'feeds: tail on this story (west), head toward Japan (east)');
  const fed = tailHead({ ...base, link: { ...base.link, direction: 'fed' } });
  assert.ok(fed.tail > fed.tip, 'fed: tail at the other story (east), head toward this one');
  assert.ok(Math.abs(feeds.tip - fed.tip) > 100);
});

test('svg: no new country means no arrow and the block says the same places', () => {
  const svg = buildStoryCardSvg({ ...BASE, link: { ...LINK, countries: ['SAU', 'YEM'] } });
  assert.ok(svg.includes('a story in the same places'));
  assert.ok(!/r="9" fill/.test(svg));
});

test('png: renders at 1200 and 360 wide', async (t) => {
  let sharp;
  try { sharp = require('sharp'); } catch { try { sharp = require(path.resolve(__dirname, '../../../../global-perspectives-starter/frontend/node_modules/sharp')); } catch { sharp = null; } }
  if (!sharp) return t.skip('sharp not installed');
  for (const width of [1200, 360]) {
    const png = await renderStoryCardPng({ ...BASE, link: LINK }, { width, sharp });
    const meta = await sharp(png).metadata();
    assert.equal(meta.width, width);
    assert.equal(meta.height, Math.round((630 * width) / 1200));
  }
});
