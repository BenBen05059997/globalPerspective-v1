// Studio share UI: hidden while the endpoint is unset; only for runs that passed; honest words for every refusal;
// a read-only noindex page with honest states; the signed-out example is "not ready yet" until a real share exists.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const api = vi.hoisted(() => ({ token: 'tok', fetchMock: vi.fn() }));
vi.mock('@/shared/api/restProxy', () => ({ currentAuthToken: async () => api.token }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));

import ShareControl from '@/features/analysis-studio/components/ShareControl.jsx';
import SharedAnalysisPage from '@/features/analysis-studio/SharedAnalysisPage.jsx';
import SignedOutExample from '@/features/analysis-studio/components/SignedOutExample.jsx';
import { buildSharePayload, shareableSections, sameCitations } from '@/features/analysis-studio/lib/sharePayload.js';
import { shareConfigured, shareErrorMessage, loadMyShares } from '@/features/analysis-studio/lib/shareApi.js';

const CITES = [{ n: 1, kind: 'NEWS', date: '2026-09-05', label: 'Reuters', storyTitle: 'S', url: 'https://ex.com/1' }, { n: 2, kind: 'ANALYSIS', date: null, label: 'Stored thread analysis', storyTitle: 'S', url: null }];
const section = (over = {}) => ({ id: 1, lensId: 'freeform', mode: 'freeform', report: 'Bottom line [1][2].', citations: CITES, webSources: [], checks: { hasError: false, warnings: [], ok: true }, struct: null, ranOnServer: false, byokModel: 'deepseek-v4-pro', createdAt: '2026-10-05T11:00:00Z', ...over });
const topics = [{ topicId: 't1', threadId: 'thread-a-1', title: 'Story one' }];
const SHARE = {
  id: 'A'.repeat(22), runAt: '2026-10-05T11:00:00Z', sourcesFrozenAt: '2026-10-05T12:00:00Z', owner: false,
  stories: [{ topicId: 't1', threadId: 'thread-a-1', title: 'Story one' }],
  sources: [{ n: 1, kind: 'NEWS', date: '2026-09-05', label: 'Reuters', storyTitle: 'Story one', url: 'https://ex.com/1', text: 'The verbatim snippet.' }, { n: 2, kind: 'ANALYSIS', date: null, label: 'Stored thread analysis', storyTitle: 'Story one', url: 'javascript:alert(1)', text: 'Trajectory: escalating' }],
  sections: [{ lensId: 'freeform', mode: 'freeform', prose: 'Bottom line [1][2].', struct: null, webSources: [{ n: 1, title: 'A web page', url: 'https://web.example/x' }, { n: 2, title: 'Bad link', url: null }], checks: { hasError: false, warnings: [] } }],
  run: { provider: 'deepseek', model: 'deepseek-v4-pro' },
};

beforeEach(() => { delete window.NEWS_SHARE_ENDPOINT; api.token = 'tok'; localStorage.clear(); api.fetchMock = vi.fn(); window.fetch = api.fetchMock; });
afterEach(() => { delete window.NEWS_SHARE_ENDPOINT; });
const jsonRes = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('sharePayload', () => {
  it('only sections that passed are shareable; the payload carries prose, numbering and stories, never source text', () => {
    const bad = section({ id: 2, checks: { hasError: true, warnings: [{ severity: 'error', message: 'x' }] } });
    expect(shareableSections([section(), bad])).toHaveLength(1);
    const p = buildSharePayload({ sections: [section(), bad], selectedTopics: topics, byok: { provider: 'deepseek' } });
    expect(p.sections).toHaveLength(1);
    expect(p.stories).toEqual([{ topicId: 't1', threadId: 'thread-a-1' }]);
    expect(p.citations[0]).toEqual({ n: 1, kind: 'NEWS', date: '2026-09-05', label: 'Reuters', url: 'https://ex.com/1' });
    expect(JSON.stringify(p)).not.toMatch(/snippet|storyTitle/);
    expect(p.run).toMatchObject({ provider: 'deepseek', model: 'deepseek-v4-pro' });
  });
  it('nothing passed -> null; sections that cited different sources cannot be shared together', () => {
    expect(buildSharePayload({ sections: [section({ checks: { hasError: true, warnings: [] } })], selectedTopics: topics })).toBeNull();
    expect(sameCitations([section(), section({ id: 2, citations: CITES.slice(0, 1) })])).toBe(false);
    expect(sameCitations([section(), section({ id: 2 })])).toBe(true);
  });
});

describe('shareApi words', () => {
  it('every refusal has its own plain sentence', () => {
    expect(shareErrorMessage(429, { error: 'daily_limit', limit: 20 })).toMatch(/today's limit of 20/);
    expect(shareErrorMessage(409, { error: 'sources_changed' })).toMatch(/Run it again to share/);
    expect(shareErrorMessage(422, { error: 'checks_failed', failures: [{ reasons: ['Cites [99] but only 8 sources were provided'] }] })).toMatch(/cannot be shared: Cites \[99\]/);
    expect(shareErrorMessage(401)).toMatch(/Sign in/);
    expect(shareErrorMessage(500, {})).not.toMatch(/something went wrong/i);
  });
  it('shareConfigured follows window.NEWS_SHARE_ENDPOINT', () => {
    expect(shareConfigured()).toBe(false);
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    expect(shareConfigured()).toBe(true);
  });
});

describe('ShareControl', () => {
  it('renders nothing while the endpoint is unset', () => {
    const { container } = render(<ShareControl sections={[section()]} selectedTopics={topics} byok={null} />);
    expect(container.firstChild).toBeNull();
  });
  it('renders nothing when no section passed its checks (a failed run has no share button at all)', () => {
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    const { container } = render(<ShareControl sections={[section({ checks: { hasError: true, warnings: [] } })]} selectedTopics={topics} byok={null} />);
    expect(container.firstChild).toBeNull();
  });
  it('shares, shows the link with Copy / Open / Delete, and remembers it in this browser', async () => {
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    api.fetchMock.mockResolvedValueOnce(jsonRes(201, { id: 'B'.repeat(22) }));
    render(<ShareControl sections={[section()]} selectedTopics={topics} byok={{ provider: 'deepseek' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Share this analysis/ }));
    await waitFor(() => expect(screen.getByLabelText('Share link')).toBeInTheDocument());
    expect(screen.getByLabelText('Share link').value).toMatch(/\/analyze\/s\/B{22}$/);
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Delete' }).length).toBeGreaterThanOrEqual(1);
    const sent = JSON.parse(api.fetchMock.mock.calls[0][1].body);
    expect(sent.sections).toHaveLength(1);
    expect(api.fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(loadMyShares()[0].id).toBe('B'.repeat(22));
  });
  it('a refusal is worded, not "something went wrong"', async () => {
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    api.fetchMock.mockResolvedValueOnce(jsonRes(429, { error: 'daily_limit', limit: 20 }));
    render(<ShareControl sections={[section()]} selectedTopics={topics} byok={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Share this analysis/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/today's limit of 20/));
  });
  it('a broken localStorage does not break sharing', async () => {
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    api.fetchMock.mockResolvedValueOnce(jsonRes(201, { id: 'C'.repeat(22) }));
    render(<ShareControl sections={[section()]} selectedTopics={topics} byok={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Share this analysis/ }));
    await waitFor(() => expect(screen.getByLabelText('Share link')).toBeInTheDocument());
    spy.mockRestore();
  });
});

const renderPage = (id = 'A'.repeat(22)) => render(
  <MemoryRouter initialEntries={[`/analyze/s/${id}`]}><Routes><Route path="/analyze/s/:id" element={<SharedAnalysisPage />} /></Routes></MemoryRouter>,
);

describe('SharedAnalysisPage', () => {
  it('endpoint unset: "not available yet", and the page is still noindex', () => {
    renderPage();
    expect(screen.getByText('Shared analyses are not available yet')).toBeInTheDocument();
    expect(document.querySelector('meta[name="robots"][content="noindex,nofollow"]')).toBeTruthy();
  });
  it('unknown / deleted id: the honest 404 copy', async () => {
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    api.fetchMock.mockResolvedValueOnce(jsonRes(404, { error: 'not_found' }));
    renderPage();
    await waitFor(() => expect(screen.getByText('This shared analysis was deleted or never existed')).toBeInTheDocument());
  });
  it('a service failure says it could not be loaded (and does not claim the share is gone)', async () => {
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    api.fetchMock.mockResolvedValueOnce(jsonRes(500, {}));
    renderPage();
    await waitFor(() => expect(screen.getByText('This shared analysis could not be loaded right now')).toBeInTheDocument());
    expect(screen.queryByText(/deleted or never existed/)).toBeNull();
  });
  it('ready: frozen date, reader-written label, sources with verbatim text, only http(s) links, no delete for a stranger', async () => {
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    api.fetchMock.mockResolvedValueOnce(jsonRes(200, { share: SHARE }));
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText(/Shared analysis · read-only/)).toBeInTheDocument());
    expect(screen.getByText(/sources frozen Oct 5 2026/)).toBeInTheDocument();
    expect(screen.getByText(/written by a reader with their own/)).toBeInTheDocument();
    expect(screen.getByText('The verbatim snippet.')).toBeInTheDocument();
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href')).filter(Boolean);
    expect(hrefs.some((h) => /^javascript:/i.test(h))).toBe(false);
    expect(screen.getByText(/not checked by us/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete this share/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Run your own →' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Story one' }).getAttribute('href')).toBe('/weekly/thread/thread-a-1');
  });
  it('the owner can delete; after deleting the page says so', async () => {
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.fetchMock.mockResolvedValueOnce(jsonRes(200, { share: { ...SHARE, owner: true } })).mockResolvedValueOnce(jsonRes(204, null));
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /Delete this share/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Delete this share/ }));
    await waitFor(() => expect(screen.getByText('This shared analysis was deleted or never existed')).toBeInTheDocument());
    expect(api.fetchMock.mock.calls[1][1].method).toBe('DELETE');
  });
  it('the noindex tag is removed when the page unmounts (the SPA shell is shared)', () => {
    const { unmount } = renderPage();
    expect(document.querySelector('meta[name="robots"]')).toBeTruthy();
    unmount();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });
});

describe('SignedOutExample', () => {
  it('no real example yet: "not ready yet" with what to expect, never a mock-up', () => {
    render(<MemoryRouter><SignedOutExample exampleId={null} /></MemoryRouter>);
    expect(screen.getByTestId('studio-example-off')).toHaveTextContent(/Example analysis: not ready yet\./);
    expect(screen.getByTestId('studio-example-off')).toHaveTextContent(/first shared analysis will appear here as a read-only example/);
  });
  it('with a real example id and the endpoint set: the read-only debrief is shown', async () => {
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    api.fetchMock.mockResolvedValueOnce(jsonRes(200, { share: SHARE }));
    render(<MemoryRouter><SignedOutExample exampleId={'A'.repeat(22)} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('studio-example')).toBeInTheDocument());
    expect(screen.getByText(/Sign in to run with your own key|Sign in to run your own/)).toBeInTheDocument();
  });
  it('an example id whose share is gone falls back to the honest not-ready line', async () => {
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    api.fetchMock.mockResolvedValueOnce(jsonRes(404, {}));
    render(<MemoryRouter><SignedOutExample exampleId={'A'.repeat(22)} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('studio-example-off')).toBeInTheDocument());
  });
});
