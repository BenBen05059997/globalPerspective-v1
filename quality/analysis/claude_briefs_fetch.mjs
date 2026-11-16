// Claude comparison for the briefs-and-analysis jobs (2026-11-16): fetch the public record views once into a local cache.
// Read-only GET of https://globalperspective.net/data/record/views/*. Usage: node claude_briefs_fetch.mjs <cacheDir>
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://globalperspective.net/data/record/views';
const cache = process.argv[2];
if (!cache) throw new Error('usage: node claude_briefs_fetch.mjs <cacheDir>');
const get = async (rel) => {
  const f = path.join(cache, rel);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`${BASE}/${rel}`, { headers: { 'User-Agent': 'gp-model-quality/1.0' } });
    if (r.status === 404) return null;
    if (r.ok) { const t = await r.text(); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); return JSON.parse(t); }
    await new Promise((x) => setTimeout(x, 1000 * (a + 1)));
  }
  throw new Error(`fetch failed ${rel}`);
};
const SINCE = process.env.SINCE || '2026-10-12';
const active = await get('index/active.json');
const ids = active.stories.filter((s) => (s.lastEntryAt || '') >= SINCE).map((s) => s.threadId);
console.log('stories since', SINCE, ids.length);
let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (i < ids.length) { const id = ids[i++]; await get(`stories/${id}.json`); } }));
await get('index/today.json'); await get('index/web.json'); await get('index/briefs.json'); await get('manifest.json');
const briefs = await get('index/briefs.json');
for (const d of briefs.daily) await get(`briefs/daily/${d.dateKey}.json`);
for (const w of briefs.weekly || []) await get(`briefs/weekly/${w.weekOf}.json`);
const iso = new Set(active.stories.filter((s) => (s.lastEntryAt || '') >= SINCE).flatMap((s) => s.iso3 || []));
for (const c of iso) await get(`countries/${c}.json`);
console.log('done; countries', iso.size);
