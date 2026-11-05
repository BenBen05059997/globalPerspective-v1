import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';
import { useEffect } from 'react';
import { PageViewBridge } from '@/app/pageViews';

// a page that names itself on mount, as the feature pages do
function Page({ title }) {
  useEffect(() => { if (title) document.title = title; }, [title]);
  return null;
}

// MemoryRouter leaves window.location alone, which the page_view reads (BrowserRouter keeps them equal), so the tests move both
let go;
function Nav() {
  const navigate = useNavigate();
  go = (path) => { window.history.pushState({}, '', path); navigate(path); };
  return null;
}

function mount(initial = '/today') {
  window.history.pushState({}, '', initial);
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <PageViewBridge />
      <Nav />
      <Routes>
        <Route path="/today" element={<Page title="Today page" />} />
        <Route path="/track-record" element={<Page title="Track page" />} />
        <Route path="/late" element={<Page />} />
        <Route path="/same" element={<Page title="Today page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

const settle = () => act(async () => { await Promise.resolve(); });

describe('GA page_view', () => {
  let gtag;
  beforeEach(() => {
    vi.useFakeTimers();
    gtag = vi.fn();
    window.gtag = gtag;
    document.title = 'Static shell title';
  });
  afterEach(() => {
    act(() => { vi.advanceTimersByTime(5000); }); // settle anything pending
    vi.useRealTimers();
    delete window.gtag;
  });

  it('sends the first view once, with the route title and not the shell title', async () => {
    mount('/today');
    await settle();
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'page_view', expect.objectContaining({ page_title: 'Today page', page_location: 'http://localhost:3000/today' }));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it('a route change sends one more view with the new route title', async () => {
    mount('/today');
    await settle();
    act(() => { go('/track-record'); });
    await settle();
    expect(gtag).toHaveBeenCalledTimes(2);
    expect(gtag.mock.calls[1][2].page_title).toBe('Track page');
  });

  it('a page that names itself late (after its data) is sent when it does, not before', async () => {
    mount('/late');
    await settle();
    expect(gtag).not.toHaveBeenCalled();
    act(() => { document.title = 'Late title'; });
    await settle();
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0][2].page_title).toBe('Late title');
  });

  it('a page that never sets a title is sent after the wait, with the title it has', async () => {
    mount('/late');
    act(() => { vi.advanceTimersByTime(1499); });
    expect(gtag).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2); });
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0][2].page_title).toBe('Static shell title');
  });

  it('a second page with the same title is still counted, at the latest after the wait', async () => {
    mount('/today');
    await settle();
    act(() => { go('/same'); });
    act(() => { vi.advanceTimersByTime(1500); });
    expect(gtag).toHaveBeenCalledTimes(2);
    expect(gtag.mock.calls[1][2]).toEqual({ page_title: 'Today page', page_location: 'http://localhost:3000/same' });
  });

  it('leaving a route before its title arrives still counts it', async () => {
    mount('/late');
    act(() => { go('/track-record'); });
    await settle();
    expect(gtag).toHaveBeenCalledTimes(2);
    expect(gtag.mock.calls[0][2].page_title).toBe('Static shell title');
    expect(gtag.mock.calls[1][2].page_title).toBe('Track page');
  });

  it('does nothing when gtag is absent (blocked or not loaded)', async () => {
    delete window.gtag;
    mount('/today');
    await settle();
    expect(gtag).not.toHaveBeenCalled();
  });
});
