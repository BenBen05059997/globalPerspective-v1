import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';

const fetchAlert = vi.fn();
vi.mock('@/shared/api/restProxy', () => ({ fetchAlert: (...a) => fetchAlert(...a) }));
import {
  MarketsRedirect, BreakingFeedRedirect, BreakingDetailRedirect, SpiderDemoRedirect, DailyRedirect, WeeklyBriefRedirect, WeeklyRoute, AnalyzeRedirect,
} from '@/app/LegacyRedirects';

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname}{search}</div>;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Where />} />
        <Route path="/briefings" element={<Where />} />
        <Route path="/weekly/thread/:threadId" element={<Where />} />
        <Route path="/weekly-markets" element={<MarketsRedirect />} />
        <Route path="/weekly" element={<WeeklyRoute><Where /></WeeklyRoute>} />
        <Route path="/weekly/countries" element={<Where />} />
        <Route path="/daily" element={<DailyRedirect />} />
        <Route path="/daily/:dateKey" element={<DailyRedirect />} />
        <Route path="/weekly-brief" element={<WeeklyBriefRedirect />} />
        <Route path="/spider-demo" element={<SpiderDemoRedirect />} />
        <Route path="/analyze" element={<AnalyzeRedirect />} />
        <Route path="/breaking" element={<BreakingFeedRedirect />} />
        <Route path="/breaking/:id" element={<BreakingDetailRedirect />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchAlert.mockReset();
  window.USER_PREFS_ENDPOINT = 'https://example.test/prefs';
});

describe('retired routes (P6, decisions 1 and 2)', () => {
  it('/weekly-markets -> /briefings?from=markets (the paused note mechanism)', () => {
    renderAt('/weekly-markets');
    expect(screen.getByTestId('where').textContent).toBe('/briefings?from=markets');
  });

  it('/spider-demo -> /weekly?view=web (P7b: the prototype retired into the Stories WEB view)', () => {
    renderAt('/spider-demo');
    expect(screen.getByTestId('where').textContent).toBe('/weekly?view=web');
  });

  it('/breaking -> /', () => {
    renderAt('/breaking');
    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  it('/breaking/:id -> the alert story when it resolves to one (has an arc and a thread id)', async () => {
    fetchAlert.mockResolvedValue({ alert: { id: 'a1', hasArc: true, threadId: 'thread 9' } });
    renderAt('/breaking/a1');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/weekly/thread/thread%209'));
    expect(fetchAlert).toHaveBeenCalledWith('a1');
  });

  it('/breaking/:id -> / when the alert has no story (no arc), is unknown, or the read fails', async () => {
    fetchAlert.mockResolvedValueOnce({ alert: { id: 'a2', hasArc: false, threadId: 't' } });
    const first = renderAt('/breaking/a2');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
    first.unmount();

    fetchAlert.mockResolvedValueOnce({ alert: null });
    const second = renderAt('/breaking/none');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
    second.unmount();

    fetchAlert.mockRejectedValueOnce(new Error('boom'));
    renderAt('/breaking/err');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
  });

  it('/breaking/:id -> / right away when alerts are not configured (no endpoint)', async () => {
    delete window.USER_PREFS_ENDPOINT;
    renderAt('/breaking/a3');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
    expect(fetchAlert).not.toHaveBeenCalled();
  });
});

describe('briefings merge (2026-10-19): old addresses land on /briefings modes', () => {
  it('/daily -> /briefings?mode=read', () => {
    renderAt('/daily');
    expect(screen.getByTestId('where').textContent).toBe('/briefings?mode=read');
  });

  it('/daily/:date -> /briefings?mode=read&date=:date', () => {
    renderAt('/daily/2026-09-12');
    expect(screen.getByTestId('where').textContent).toBe('/briefings?mode=read&date=2026-09-12');
  });

  it('/daily/<not a date> -> the latest edition, never a guessed date', () => {
    renderAt('/daily/yesterday');
    expect(screen.getByTestId('where').textContent).toBe('/briefings?mode=read');
  });

  it('/weekly-brief -> /briefings?mode=weekly', () => {
    renderAt('/weekly-brief');
    expect(screen.getByTestId('where').textContent).toBe('/briefings?mode=weekly');
  });
});

describe('the countries list keeps one address', () => {
  it('/weekly?section=countries -> /weekly/countries', () => {
    renderAt('/weekly?section=countries');
    expect(screen.getByTestId('where').textContent).toBe('/weekly/countries');
  });

  it('any other /weekly stays on the Stories page with its query', () => {
    renderAt('/weekly?view=web');
    expect(screen.getByTestId('where').textContent).toBe('/weekly?view=web');
  });
});

describe('the retired Analysis Studio (2026-10-20)', () => {
  it('/analyze?stories=<thread id,...> -> the first thread story', () => {
    renderAt('/analyze?stories=thread-a-1%2Cthread-b-2');
    expect(screen.getByTestId('where').textContent).toBe('/weekly/thread/thread-a-1');
  });

  it('/analyze with no stories, or a topic id that is not a thread id -> the countries list', () => {
    const first = renderAt('/analyze');
    expect(screen.getByTestId('where').textContent).toBe('/weekly/countries');
    first.unmount();
    renderAt('/analyze?stories=t1');
    expect(screen.getByTestId('where').textContent).toBe('/weekly/countries');
  });
});
