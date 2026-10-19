// quality/check_links.mjs — the ratchet on hand-built page addresses: what counts as one, what is ignored,
// which files are allowed to build routes, and the live repo against its baseline. Also the copied-text
// footers in shared/ui/CopyBriefing.jsx, which now build their addresses with links.js.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compare, measure } from '../../../../../../quality/ratchet.mjs';
import { countRoutes, stripJsComments, skipAllowed } from '../../../../../../quality/check_links.mjs';
import { formatCountryBriefing, formatDailyBrief, formatThreadBriefing } from '@/shared/ui/CopyBriefing.jsx';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../..');

describe('countRoutes', () => {
  it('counts route strings in code, by route', () => {
    const n = countRoutes("navigate(`/weekly/country/${c}`); <Link to=\"/track-record\">; x = '/?focus=' + id; y = '/daily/' + k;", 'a.jsx');
    expect(n).toMatchObject({ '/weekly/country': 1, '/track-record': 1, '/?focus': 1, '/daily': 1, '/analyze': 0 });
  });
  it('a longer path segment, another host or an API path is not a route; the site host is', () => {
    const n = countRoutes("'/weekly/countries'; '/todays'; 'https://example.com/today'; base + 'api/daily'; '/daily-x'", 'a.js');
    expect(Object.values(n).reduce((a, b) => a + b, 0)).toBe(0);
    expect(countRoutes('`globalperspective.net/daily/${d}`', 'a.js')['/daily']).toBe(1);
    expect(countRoutes('`${site}/weekly/thread/${id}`', 'a.js')['/weekly/thread']).toBe(1);
  });
  it('ignores comments and CSS', () => {
    expect(stripJsComments("// '/today'\n * '/today'\n{/* '/today' */}\nconst a = 1; // '/today'")).not.toContain('/today');
    expect(stripJsComments("const u = 'https://globalperspective.net/today';")).toContain('/today');
    expect(countRoutes(".x { background: url('/today.png'); }", 'a.css')).toEqual({});
  });
  it('the links modules, the route table, redirects and tests may build routes', () => {
    for (const f of ['shared/lib/links.js', 'app/App.jsx', 'app/LegacyRedirects.jsx', 'backend/shared/src/links.js',
      'backend/x/test/a.js', 'backend/x/src/test-sender.js']) expect(skipAllowed(f)).toBe(true);
    expect(skipAllowed('features/map/SituationHome.jsx')).toBe(false);
  });
  it('the live repo does not rise above the baseline', () => {
    const base = JSON.parse(fs.readFileSync(path.join(repoRoot, 'quality/links_baseline.json'), 'utf8')).files;
    expect(compare(measure(repoRoot, countRoutes, skipAllowed, ['backend']), base).rose).toEqual([]);
  });
});

describe('CopyBriefing footers use links.js', () => {
  it('country footer uses the canonical name; a non-country gets the site only', () => {
    expect(formatCountryBriefing('United Arab Emirates', null, null)).toContain('globalperspective.net/weekly/country/UAE');
    expect(formatCountryBriefing('Strait of Hormuz', null, null).split('\n').pop()).toBe('— Global Perspectives · globalperspective.net');
  });
  it('daily footer points at the briefing date; thread footer at the story', () => {
    expect(formatDailyBrief({ dateKey: '2026-10-18' }).split('\n').pop()).toBe('— Global Perspectives · globalperspective.net/briefings?date=2026-10-18');
    expect(formatThreadBriefing({ threadId: 't-1', latestTitle: 'T', articleCount: 3, dayCount: 2, regions: ['Iran'] }, null).split('\n').pop()).toBe('— Global Perspectives · globalperspective.net/weekly/thread/t-1');
  });
});
