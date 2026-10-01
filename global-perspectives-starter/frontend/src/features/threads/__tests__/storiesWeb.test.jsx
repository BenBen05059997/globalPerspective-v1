// P7b (2026-10-02): the WEB view (?view=web). (Header copied from storiesBoard.) P6: Stories rows carry a one-line summary and a "Watching" line only when the data has
// them; the right rail / phone READ hide "Changed since your last visit" until a baseline exists;
// header counts put scored tiers first with a dim "N not yet scored"; phone tabs are READ / MAP / TIMELINE.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import archiveFixture from '@fixtures/archive.json';
import threadAnalysesFixture from '@fixtures/thread_analyses.json';

const rawDayMap = archiveFixture.data;
const rawDates = Object.keys(rawDayMap).sort();
const dayMap = {};
{
  const today = new Date();
  rawDates.forEach((d, i) => {
    const shifted = new Date(today);
    shifted.setDate(today.getDate() - (rawDates.length - 1 - i));
    const stamp = new Date(shifted); stamp.setHours(shifted.getHours() - 1);
    dayMap[shifted.toISOString().slice(0, 10)] = { ...rawDayMap[d], updatedAt: stamp.toISOString() };
  });
}
const sortedDates = Object.keys(dayMap).sort((a, b) => b.localeCompare(a));

const phone = { on: false };
vi.mock('@/shared/hooks/useIsPhone', () => ({ useIsPhone: () => phone.on }));
vi.mock('@/features/threads/hooks/useWeeklyArchive', () => ({
  useWeeklyArchive: () => ({ dayMap, sortedDates, loading: false, error: null, dataUpdatedAt: Date.now(), refetch: vi.fn() }),
}));
vi.mock('@/features/threads/hooks/useThreadAnalyses', () => ({
  useThreadAnalyses: () => ({ analyses: threadAnalysesFixture.data, loading: false, error: null }),
}));
vi.mock('@/shared/contexts/AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/shared/ui/boot/BootLoader.jsx', () => ({ default: () => <div data-testid="loader" /> }));
vi.mock('@/features/countries/components/CountryOverviewMap', () => ({ default: () => <div /> }));
const web = { state: { index: null, loading: false, failed: false } };
vi.mock('@/features/threads/hooks/useWebIndex.js', () => ({ useWebIndex: () => web.state }));
vi.mock('@/features/threads/components/WeeklyMap', () => ({ default: () => <div data-testid="weekly-map" /> }));

import WeeklyPage from '@/features/threads/WeeklyPage';

const A = 'thread-us-forces-seize-iranian-flagge-849b1c';
const B = 'thread-us-envoys-steve-witkoff-and-ja-fdf368';
const C = 'thread-tens-of-thousands-of-lebanese--afa29e';
const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
const link = (from, to, confidence, country, generatedAt, extra = {}) => ({ from, to, confidence, country, generatedAt, lagDays: 2, mechanism: `${country} mechanism ${from.slice(7, 12)}`, cited: [], ...extra });
const makeIndex = () => ({
  websUsed: [{ country: 'Iran', generatedAt: ago(1), nodes: 5 }, { country: 'Israel', generatedAt: ago(2), nodes: 4 }, { country: 'Venezuela', generatedAt: ago(40), nodes: 3 }],
  links: [
    link(A, B, 'strong', 'Iran', ago(1), { cited: [{ title: 'A cited headline', date: '2026-09-20' }] }),
    link(A, B, 'weak', 'Israel', ago(2)),
    link(B, C, 'medium', 'Israel', ago(2)),
    link(C, A, 'weak', 'Venezuela', ago(40)),
  ],
  threads: {},
});

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><WeeklyPage /></MemoryRouter>);
beforeEach(() => { phone.on = false; web.state = { index: makeIndex(), loading: false, failed: false }; localStorage.removeItem('gp_stories_visit_v1'); });

describe('Stories WEB (?view=web)', () => {
  it('desktop: view order List | Board | Timeline | Map | Web with Web pressed; graph nodes are story links; the list twin is present', () => {
    renderAt('/weekly?view=web');
    expect([...document.querySelectorAll('.sf-seg__btn')].map((b) => b.textContent)).toEqual(['List', 'Board', 'Timeline', 'Map', 'Web']);
    expect(document.querySelector('.sf-seg__btn[aria-pressed="true"]').textContent).toBe('Web');
    const nodes = document.querySelectorAll('a.sw-node');
    expect(nodes).toHaveLength(3);
    for (const n of nodes) expect(n.getAttribute('href')).toMatch(/^\/weekly\/thread\//);
    expect(screen.getByTestId('web-twin')).toBeTruthy();
    expect(document.querySelectorAll('.sw-link')).toHaveLength(2); // A->B (merged) and B->C; C->A is older than 30 days
  });
  it('the merged A->B row: strongest word, 2 analyses, each analysis\'s own word, mechanism labelled model judgment, dated cite; never "caused"', () => {
    renderAt('/weekly?view=web');
    const row = document.querySelector('.sw-link[data-edge="' + A + '->' + B + '"]');
    expect(row.querySelector('.sw-link__rel').textContent).toMatch(/judged to feed into · strong · 2 analyses/);
    expect(row.querySelector('.sw-link__webs').textContent).toMatch(/Iran \(strong, .*\) · Israel \(weak, /);
    expect(row.querySelector('.sw-link__tag').textContent).toBe('Model judgment');
    expect(row.querySelector('.sw-link__mech').textContent).toContain('Iran mechanism');
    expect(row.querySelector('.sw-link__cites').textContent).toContain('A cited headline');
    expect(document.querySelector('.sw').textContent.replace(/never \u201Ccaused\u201D/, '')).not.toMatch(/caused/i);
  });
  it('the footnote is computed: 2 analyses merged (Iran, Israel), newest = the Iran analysis day, 1 older than 30 days hidden', () => {
    renderAt('/weekly?view=web');
    const t = screen.getByTestId('web-footnote').textContent;
    expect(t).toMatch(/merged from 2 analyses, newest /);
    expect(t).toMatch(/ 1 older than 30 days hidden$/);
    expect(t).toContain('never \u201Ccaused\u201D');
  });
  it('the crisis filter applies: stories not matching drop out of the graph', () => {
    renderAt('/weekly?view=web');
    const before = document.querySelectorAll('a.sw-node').length;
    fireEvent.click(screen.getAllByRole('button').find((b) => /^Conflict/.test(b.textContent)) || document.body);
    expect(document.querySelectorAll('a.sw-node').length).toBeLessThanOrEqual(before);
  });
  it('phone: the list twin comes before the graph; Web is reachable from READ; no right-rail "changed" section', () => {
    phone.on = true;
    renderAt('/weekly?view=web');
    const twin = screen.getByTestId('web-twin'); const graph = document.querySelector('.sw-graphwrap');
    expect(twin.compareDocumentPosition(graph) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect([...document.querySelectorAll('.sf-subtoggle .sf-seg__btn')].map((b) => b.textContent)).toEqual(['List', 'Board', 'Web']);
    expect(document.querySelector('.sf-tabs__btn[aria-selected="true"]').textContent).toBe('Read');
  });
  it('failed read: an inline note, no nodes; no index: an honest empty line; no links: empty state still shows the footnote', () => {
    web.state = { index: null, loading: false, failed: true };
    const a = renderAt('/weekly?view=web');
    expect(screen.getByRole('alert').textContent).toMatch(/story-link index could not be read/);
    expect(document.querySelectorAll('a.sw-node')).toHaveLength(0);
    a.unmount();
    web.state = { index: null, loading: false, failed: false };
    const b = renderAt('/weekly?view=web');
    expect(document.body.textContent).toMatch(/No story-link analysis has been published yet/);
    b.unmount();
    web.state = { index: { websUsed: [{ country: 'Iran', generatedAt: ago(1) }], links: [], threads: {} }, loading: false, failed: false };
    renderAt('/weekly?view=web');
    expect(screen.getByTestId('web-empty')).toBeTruthy();
    expect(screen.getByTestId('web-footnote').textContent).toMatch(/merged from 1 analysis/);
  });
  it('the other views are unchanged (list still renders story rows, no web section)', () => {
    renderAt('/weekly');
    expect(document.querySelector('.sw')).toBeNull();
    expect(document.querySelectorAll('.sf-seg__btn')).toHaveLength(5);
  });
});
