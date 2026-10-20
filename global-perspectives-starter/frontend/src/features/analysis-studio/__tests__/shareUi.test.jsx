// Shared-run page (the Studio retired 2026-10-20; links already out there keep working): a read-only noindex
// page with honest states.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const api = vi.hoisted(() => ({ token: 'tok', fetchMock: vi.fn() }));
vi.mock('@/shared/api/restProxy', () => ({ currentAuthToken: async () => api.token }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));

import SharedAnalysisPage from '@/features/analysis-studio/SharedAnalysisPage.jsx';
import { shareConfigured } from '@/features/analysis-studio/lib/shareApi.js';

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

describe('shareApi', () => {
  it('shareConfigured follows window.NEWS_SHARE_ENDPOINT', () => {
    expect(shareConfigured()).toBe(false);
    window.NEWS_SHARE_ENDPOINT = 'https://share.example/';
    expect(shareConfigured()).toBe(true);
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
    expect(screen.getByRole('link', { name: 'Browse the countries →' }).getAttribute('href')).toBe('/weekly/countries');
    expect(screen.queryByText(/Run your own/)).toBeNull();
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
