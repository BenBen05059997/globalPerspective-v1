// Unit tests for the news grouping rules in situations-core (no AWS). Run: node --test (from backend/shared)
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const core = require('../src/situations-core.js');
const { planNewsGrouping, buildStorySituation, normalizeUrl, normalizeTitle, isLiveUrl, outletOf, MEMBER_URL_CAP } = core;

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log(`  ok ${name}`); };
const TTL = 9999999999;
const T = (h) => `2026-11-03T${String(h).padStart(2, '0')}:00:00.000Z`;

const story = (storyId, over = {}) => ({
  storyId, title: storyId, axis: 'conflict', max_severity: 4, outlets: 3, velocity: 1, spread_new_iso3: [],
  centroid: { lat: 1, lon: 2 }, iso3: [storyId.split('#')[1]], category: 'war', headlines: [], ...over,
});
const heads = (...urls) => urls.map((url) => ({ title: `h ${url}`, url, domain: 'x.com' }));
const group = (st, threadId = null) => ({ id: `news#${st.storyId}`, threadId, stories: [st], aliases: [], prev: null });

// One tracker sweep without I/O: a group per story, strict grouping, build, fold into the next prior map.
function sweep(stories, prior, hour, { threads = {} } = {}) {
  const groups = stories.map((st) => group(st, threads[st.storyId] || null));
  for (const g of groups) g.prev = prior[g.id] || null;
  const plan = planNewsGrouping(groups, prior);
  const next = { ...prior };
  for (const id of plan.absorbed) delete next[id];
  for (const g of plan.groups) {
    next[g.id] = buildStorySituation(g.prev, core.mergeStories(g.stories), T(hour), TTL, { situationId: g.id, threadId: g.threadId, aliases: g.aliases, grouping: g.grouping }).item;
  }
  return { ...plan, next };
}

t('normalizeUrl: lowercase host, no query/fragment/trailing slash; non-http is null', () => {
  assert.strictEqual(normalizeUrl('HTTPS://Example.COM/Story/1/?utm=2#top'), 'https://example.com/Story/1');
  assert.strictEqual(normalizeUrl('https://example.com/a/'), normalizeUrl('https://example.com/a?x=1'));
  assert.strictEqual(normalizeUrl('ftp://example.com/a'), null);
  assert.strictEqual(normalizeUrl('not a url'), null);
  assert.strictEqual(normalizeTitle('  Foo   BAR\nbaz '), 'foo bar baz');
});

t('URL rule across sweeps: a URL a situation held earlier joins a different story later', () => {
  const a = story('conflict#UKR#russia', { title: 'Strike on Zaporizhzhia', outlets: 4, headlines: heads('https://a.com/1', 'https://a2.com/2', 'https://a3.com/3') });
  const r1 = sweep([a], {}, 1);
  assert.deepStrictEqual(r1.merges, []);
  // sweep 2: the story key changed, its headline list now includes an old URL (with query + slash noise)
  const b = story('political#UKR#zelensky', { title: 'Zelensky reacts', outlets: 2, headlines: heads('https://A2.com/2/?ref=x', 'https://a3.com/3', 'https://b.com/9') });
  const r2 = sweep([b], r1.next, 2);
  assert.strictEqual(r2.groups.length, 1);
  assert.strictEqual(r2.groups[0].id, 'news#conflict#UKR#russia', 'the older situation survives');
  assert.strictEqual(r2.merges[0].rule, 'url');
  assert.deepStrictEqual(r2.merges[0].urls.sort(), ['https://a2.com/2', 'https://a3.com/3']);
  assert.strictEqual(r2.merges[0].sharedCount, 2);
  const s = r2.next['news#conflict#UKR#russia'];
  assert.ok(s.aliases.includes('news#political#UKR#zelensky'));
  assert.ok(s.member_story_ids.includes('political#UKR#zelensky') && s.member_story_ids.includes('conflict#UKR#russia'));
  assert.ok(s.member_urls.includes('https://b.com/9'));
});

t('title+country rule: identical normalised title and a shared country', () => {
  const a = story('conflict#IRN#qeshm', { title: 'US strikes Qeshm  island', iso3: ['IRN', 'USA'] });
  const b = story('political#USA#pentagon', { title: 'us strikes qeshm island', iso3: ['USA'] });
  const r = sweep([a, b], {}, 1);
  assert.strictEqual(r.groups.length, 1);
  assert.strictEqual(r.merges[0].rule, 'title+country');
  assert.deepStrictEqual(r.merges[0].countries, ['USA']);
  assert.deepStrictEqual(r.groups[0].grouping.also_reported_as, [], 'identical titles are not repeated as "also reported as"');
});

t('look-alikes are NOT merged: same countries different titles; same title no shared country', () => {
  const a = story('conflict#UKR#a', { title: 'Russia hits Kyiv', iso3: ['UKR', 'RUS'] });
  const b = story('political#UKR#b', { title: 'Peace talks open in Abu Dhabi', iso3: ['UKR', 'RUS'] });
  assert.strictEqual(sweep([a, b], {}, 1).groups.length, 2);
  const c = story('economic#FRA#c', { title: 'Strike hits ports', iso3: ['FRA'] });
  const d = story('economic#BRA#d', { title: 'strike hits ports', iso3: ['BRA'] });
  const r = sweep([c, d], {}, 1);
  assert.strictEqual(r.groups.length, 2);
  assert.deepStrictEqual(r.merges, []);
  // shared words in titles never merge
  const e = story('conflict#IRN#e', { title: 'Iran US talks stall', iso3: ['IRN', 'USA'] });
  const f = story('conflict#IRN#f', { title: 'Iran US talks resume', iso3: ['IRN', 'USA'] });
  assert.strictEqual(sweep([e, f], {}, 1).groups.length, 2);
});

t('grouped for life: the member story/URL still joins the survivor when it comes back alone', () => {
  const a = story('conflict#IRN#a', { title: 'Same title', iso3: ['IRN'], headlines: heads('https://a.com/1') });
  const b = story('political#IRN#b', { title: 'Same title', iso3: ['IRN'], outlets: 1, headlines: heads('https://b.com/1', 'https://b2.com/2') });
  const r1 = sweep([a, b], {}, 1);
  assert.strictEqual(r1.groups.length, 1);
  const id = r1.groups[0].id;
  // sweep 2: only b, new title, no shared URL: its story id alone keeps it in the group
  const b2 = story('political#IRN#b', { title: 'Different now', iso3: ['IRN'], headlines: heads('https://c.com/1') });
  const r2 = sweep([b2], r1.next, 2);
  assert.deepStrictEqual(r2.groups.map((g) => g.id), [id]);
  assert.strictEqual(r2.merges[0].rule, 'member');
  assert.strictEqual(r2.merges[0].isNew, false, 'a standing group is not reported as a new merge');
  // sweep 3: a brand new story id carrying a URL b ever held joins by URL
  const z = story('conflict#IRN#z', { title: 'Another', iso3: ['IRN'], headlines: heads('https://b.com/1', 'https://b2.com/2') });
  const r3 = sweep([z], r2.next, 3);
  assert.deepStrictEqual(r3.groups.map((g) => g.id), [id]);
  assert.strictEqual(r3.merges[0].rule, 'url');
  assert.ok(r3.next[id].aliases.includes('news#conflict#IRN#z'));
});

t('survivor = oldest existing situation; absorbed prior is archived by the caller; aliases and threadIds[] populated', () => {
  const a = story('conflict#UKR#a', { title: 'Alpha', headlines: heads('https://a.com/1') });
  const b = story('conflict#RUS#b', { title: 'Beta', iso3: ['RUS'], headlines: heads('https://b.com/1', 'https://b2.com/2') });
  let r = sweep([a], {}, 1, { threads: { 'conflict#UKR#a': 'thread-1' } });
  r = sweep([a, b], r.next, 2, { threads: { 'conflict#UKR#a': 'thread-1', 'conflict#RUS#b': 'thread-2' } });
  assert.deepStrictEqual(Object.keys(r.next).sort(), ['news#conflict#RUS#b', 'news#conflict#UKR#a']); // two separate so far
  const a3 = story('conflict#UKR#a', { title: 'Alpha', headlines: heads('https://a.com/1', 'https://b.com/1', 'https://b2.com/2') }); // now shares two of b's URLs
  const r3 = sweep([a3, b], r.next, 3, { threads: { 'conflict#UKR#a': 'thread-1', 'conflict#RUS#b': 'thread-2' } });
  assert.strictEqual(r3.groups.length, 1);
  const g = r3.groups[0];
  assert.strictEqual(g.id, 'news#conflict#UKR#a'); // opened first
  assert.deepStrictEqual(r3.absorbed, ['news#conflict#RUS#b']);
  const s = r3.next[g.id];
  assert.deepStrictEqual(s.threadIds.sort(), ['thread-1', 'thread-2']);
  assert.strictEqual(s.threadId, 'thread-1');
  assert.ok(s.aliases.includes('news#conflict#RUS#b'));
  assert.strictEqual(s.opened_at, T(1));
  assert.deepStrictEqual(Object.keys(r3.next), ['news#conflict#UKR#a']);
});

t('lead title = outlets x severity; the other member titles go to also_reported_as', () => {
  const a = story('conflict#IRN#a', { title: 'Small take', outlets: 1, max_severity: 3, iso3: ['IRN'], headlines: heads('https://s.com/1', 'https://s2.com/2') });
  const b = story('political#IRN#b', { title: 'Big take', outlets: 5, max_severity: 4, iso3: ['IRN'], headlines: heads('https://s.com/1', 'https://s2.com/2') });
  const r = sweep([a, b], {}, 1);
  const s = r.next[r.groups[0].id];
  assert.strictEqual(s.title, 'Big take');
  assert.deepStrictEqual(s.also_reported_as, ['Small take']);
});

t('live-blog URLs are recognised and ignored by the URL rule', () => {
  for (const u of [
    'https://www.lemonde.fr/international/live/2026/11/02/en-direct-guerre-en-ukraine_680.html',
    'https://www.aljazeera.com/news/liveblog/2026/11/3/iran-war-live-vance-sees-progress',
    'https://x.com/world/live-blog/abc', 'https://x.com/news/live-updates/ukraine', 'https://x.com/live-news/ukraine-war',
    'https://x.com/world/2026/nov/03/iran-war-live-talks', 'https://x.com/direct/ukraine', 'https://x.com/story/as-it-happened',
  ]) assert.ok(isLiveUrl(u), u);
  for (const u of [
    'https://www.france24.com/en/europe/20261103-russian-strikes-kill-26-in-ukraine-after-longest-ceasefire-ends',
    'https://www.npr.org/2026/11/02/nx-s1-6022261/hundreds-evacuate-city-during-temporary-ceasefire-between-russia-and-ukraine',
    'https://x.com/news/alive-and-well', 'https://x.com/deliver/lives',
  ]) assert.ok(!isLiveUrl(u), u);
  // two live URLs shared + one article: still only one usable shared URL, so no join
  const live = ['https://x.com/live/1', 'https://x.com/live/2'];
  const a = story('conflict#UKR#a', { headlines: heads(...live, 'https://a.com/1') });
  const b = story('political#UKR#b', { title: 'Other', headlines: heads(...live, 'https://a.com/1') });
  assert.strictEqual(sweep([a, b], {}, 1).groups.length, 2);
});

t('one shared article is not enough; two shared non-live articles join', () => {
  const a = story('conflict#UKR#a', { title: 'A', headlines: heads('https://a.com/1', 'https://a2.com/2') });
  const b1 = story('political#UKR#b', { title: 'B', headlines: heads('https://a.com/1', 'https://b2.com/2') });
  assert.strictEqual(sweep([a, b1], {}, 1).groups.length, 2);
  const b2 = story('political#UKR#b', { title: 'B', headlines: heads('https://a.com/1', 'https://a2.com/2') });
  const r = sweep([a, b2], {}, 1);
  assert.strictEqual(r.groups.length, 1);
  assert.strictEqual(r.merges[0].sharedCount, 2);
});

t('outletOf: www./amp./m. prefixes and country suffixes fold to one outlet', () => {
  assert.strictEqual(outletOf('https://www.bbc.co.uk/news/a'), 'bbc');
  assert.strictEqual(outletOf('https://www.bbc.com/news/a'), 'bbc');
  assert.strictEqual(outletOf('https://m.bbc.com/news/a'), 'bbc');
  assert.strictEqual(outletOf('https://amp.theguardian.com/a'), 'theguardian');
  assert.strictEqual(outletOf('https://www.france24.com/en/a'), 'france24');
  assert.strictEqual(outletOf('https://news.sky.com/a'), 'sky');
  assert.strictEqual(outletOf('https://www.abc.net.au/a'), 'abc');
  assert.notStrictEqual(outletOf('https://www.dw.com/a'), outletOf('https://www.france24.com/a'));
  assert.strictEqual(outletOf('not a url'), null);
});

t('2 shared articles from the SAME outlet do not join (France 24 + France 24); from different outlets they do', () => {
  const talks = story('political#USA#talks', { title: 'Trump signals progress on Iran deal', iso3: ['USA', 'IRN'], outlets: 8, headlines: heads('https://www.france24.com/en/middle-east/20261103-us-strikes-qeshm', 'https://www.france24.com/en/tv-shows/20261102-trump-promised-no-more-wars') });
  const qeshm = story('conflict#IRN#qeshm', { title: 'US strikes Qeshm Island', iso3: ['IRN', 'USA'], outlets: 3, headlines: heads('https://france24.com/en/middle-east/20261103-us-strikes-qeshm/', 'https://m.france24.com/en/tv-shows/20261102-trump-promised-no-more-wars?x=1') });
  const same = sweep([talks, qeshm], {}, 1);
  assert.strictEqual(same.groups.length, 2);
  assert.deepStrictEqual(same.merges, []);
  const qeshm2 = { ...qeshm, headlines: heads('https://www.france24.com/en/middle-east/20261103-us-strikes-qeshm/', 'https://www.bbc.co.uk/news/tv-shows/20261102-trump-promised-no-more-wars') };
  const talks2 = { ...talks, headlines: heads('https://www.france24.com/en/middle-east/20261103-us-strikes-qeshm', 'https://www.bbc.co.uk/news/tv-shows/20261102-trump-promised-no-more-wars') };
  const diff = sweep([talks2, qeshm2], {}, 1);
  assert.strictEqual(diff.groups.length, 1);
  assert.deepStrictEqual(diff.merges[0].outlets.sort(), ['bbc', 'france24']);
});

t('no chaining: a strike story sharing two articles with a talks story that leads another group does not join the strike group', () => {
  // talks (heaviest) leads; look-alike talks2 joins talks by title; strike shares two articles with talks2
  // only (a member), not with the lead talks, so it must NOT join the talks group.
  const talks = story('political#IRN#talks', { title: 'Iran US talks progress', iso3: ['IRN', 'USA'], outlets: 8, max_severity: 4, headlines: heads('https://t.com/1', 'https://t2.com/2') });
  const talks2 = story('conflict#IRN#talks2', { title: 'iran us talks progress', iso3: ['IRN'], outlets: 2, max_severity: 3, headlines: heads('https://q.com/1', 'https://q2.com/2') });
  const strike = story('conflict#IRN#qeshm', { title: 'US strikes Qeshm island', iso3: ['IRN', 'USA'], outlets: 3, max_severity: 4, headlines: heads('https://q.com/1', 'https://q2.com/2') });
  const r = sweep([talks, talks2, strike], {}, 1);
  assert.strictEqual(r.groups.length, 2, 'talks + talks2 are one group; the strike stays separate');
  const strikeGroup = r.groups.find((g) => g.id === 'news#conflict#IRN#qeshm');
  assert.ok(strikeGroup, 'the strike is its own situation');
  assert.deepStrictEqual(r.merges.map((m) => m.absorbed.id), ['news#conflict#IRN#talks2']);
  // and the strike story IS joined to the talks2 story's group when talks2 is the lead
  const heavy = { ...talks2, outlets: 9 };
  assert.strictEqual(sweep([{ ...talks, outlets: 1 }, heavy, strike], {}, 1).groups.length, 1);
});

t('a lone situation does not hold its story id as a join key (only merged ones do)', () => {
  const a = story('political#USA#trump', { title: 'One', headlines: heads('https://a.com/1') });
  const r1 = sweep([a], {}, 1);
  assert.deepStrictEqual(r1.next['news#political#USA#trump'].member_story_ids, []);
  // the same story id comes back under another thread-keyed group id, with no shared URL or title
  const again = { ...group(story('political#USA#trump', { title: 'Two', headlines: heads('https://b.com/1') })), id: 'news#USA#thread-x', threadId: 'thread-x' };
  const r2 = planNewsGrouping([again], r1.next);
  assert.deepStrictEqual(r2.merges, []);
});

t('a closed situation is never a join target', () => {
  const a = story('conflict#UKR#a', { headlines: heads('https://a.com/1', 'https://a2.com/2') });
  const r1 = sweep([a], {}, 1);
  const closed = { ...r1.next['news#conflict#UKR#a'], state: 'closed' };
  const b = story('political#UKR#b', { headlines: heads('https://a.com/1', 'https://a2.com/2') });
  const r2 = sweep([b], { [closed.situationId]: closed }, 2);
  assert.deepStrictEqual(r2.groups.map((g) => g.id), ['news#political#UKR#b']);
});

t('GDACS situations are untouched (never nodes, never absorbed)', () => {
  const gd = { situationId: 'gdacs#FL#1', source: 'gdacs', state: 'peak', title: 'Same title', iso3_affected: ['UKR'], evidence: { headlines: heads('https://a.com/1') } };
  const a = story('conflict#UKR#a', { title: 'Same title', headlines: heads('https://a.com/1') });
  const r = sweep([a], { 'gdacs#FL#1': gd }, 1);
  assert.deepStrictEqual(r.merges, []);
  assert.deepStrictEqual(r.absorbed, []);
  assert.strictEqual(r.next['gdacs#FL#1'], gd);
});

t('the URL set is capped to the most recent MEMBER_URL_CAP', () => {
  assert.strictEqual(MEMBER_URL_CAP, 200);
  const urls = Array.from({ length: 230 }, (_, i) => `https://a.com/${i}`);
  const a = story('conflict#UKR#a', { headlines: heads(...urls) });
  const r = sweep([a], {}, 1);
  const m = r.next['news#conflict#UKR#a'].member_urls;
  assert.strictEqual(m.length, 200);
  assert.strictEqual(m[199], 'https://a.com/229');
});

t('grouping off: buildStorySituation output has none of the new fields', () => {
  const st = story('conflict#UKR#a', { headlines: heads('https://a.com/1') });
  const { item } = buildStorySituation(null, core.mergeStories([st]), T(1), TTL, { situationId: 'news#conflict#UKR#a' });
  for (const k of ['member_story_ids', 'member_urls', 'threadIds', 'also_reported_as']) assert.ok(!(k in item), k);
});

console.log(`\n${pass} tests passed`);
