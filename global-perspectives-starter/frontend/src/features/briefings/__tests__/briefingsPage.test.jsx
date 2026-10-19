// /briefings modes. Read (the daily long-form, ex-/daily): "Today's Brief" only when the shown
// edition really is today's (F4, review R2); a plain, true "no new brief" line instead of
// "publishes at the end of the day" during an outage; "AI-generated" only; an error state that is
// not an empty state. Weekly (ex-/weekly-brief): KPIs, signals with sources, the week= archive
// fallback note. The mode switch writes ?mode=.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { AuthProvider } from '@/shared/contexts/AuthContext';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((auth, cb) => { cb(null); return vi.fn(); }),
  sendSignInLinkToEmail: vi.fn(),
  signInWithEmailLink: vi.fn(),
  isSignInWithEmailLink: vi.fn(() => false),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));

let dailyValue;
const dailyArgs = [];
vi.mock('@/shared/hooks/useDailyBrief', () => ({
  useDailyBrief: (dateKey) => { dailyArgs.push(dateKey); return dailyValue; },
}));
let weeklyValue;
const weeklyArgs = [];
vi.mock('@/features/briefings/hooks/useWeeklyBrief.js', () => ({
  useWeeklyBrief: (week) => { weeklyArgs.push(week); return weeklyValue; },
}));

import BriefingsPage from '@/features/briefings/BriefingsPage';
import { reportFetchError } from '@/shared/api/errorSink';

function Where() {
  const { search } = useLocation();
  return <div data-testid="where">{search}</div>;
}

function renderAt(path) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/briefings" element={<><BriefingsPage /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

const today = new Date().toISOString().slice(0, 10);
const old = '2026-09-12';
const fresh = { brief: { displayDate: today, generatedAt: new Date().toISOString(), summary: '' }, servedDateKey: today, loading: false, error: null };
const stale = { brief: { displayDate: old, generatedAt: new Date(old).toISOString(), summary: '' }, servedDateKey: old, loading: false, error: null };

beforeEach(() => {
  dailyValue = { brief: null, servedDateKey: null, loading: false, error: null, refetch: vi.fn() };
  weeklyValue = { brief: null, loading: false, error: null, refetch: vi.fn() };
  dailyArgs.length = 0;
  weeklyArgs.length = 0;
  reportFetchError.mockClear();
});

describe('read mode — heading and fallback note', () => {
  it('is the default mode and shows "Today\'s Brief" when the served edition is today\'s', () => {
    dailyValue = fresh;
    renderAt('/briefings');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Today's Brief");
    expect(document.title).toBe(`Daily Brief — ${today} | Global Perspectives`);
  });

  it('shows "Latest Brief · <date>" and "No new brief since" when the served edition is older than today', () => {
    dailyValue = stale;
    renderAt('/briefings?mode=read');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/Latest Brief/);
    expect(h1.textContent).toContain(old);
    expect(screen.getByText(/No new brief since/)).toBeInTheDocument();
    expect(screen.queryByText(/publishes at the end of the day/i)).not.toBeInTheDocument();
  });

  it('a requested past date that has no edition says which edition is shown instead', () => {
    dailyValue = { ...stale, servedDateKey: '2026-09-10', brief: { ...stale.brief, displayDate: '2026-09-10' } };
    renderAt(`/briefings?mode=read&date=${old}`);
    expect(dailyArgs).toContain(old);
    expect(screen.getByText(/showing the nearest earlier edition/)).toBeInTheDocument();
  });

  it('shows "AI-generated" only, no "analyst-reviewed" claim, and no Economic Footprint', () => {
    dailyValue = fresh;
    renderAt('/briefings');
    expect(screen.getByText('AI-generated')).toBeInTheDocument();
    expect(screen.queryByText(/analyst-reviewed/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Economic Footprint')).not.toBeInTheDocument();
  });

  it('date navigation links point at /briefings?mode=read&date=', () => {
    dailyValue = stale;
    renderAt('/briefings');
    expect(screen.getByRole('link', { name: '← Previous day' }).getAttribute('href')).toBe('/briefings?mode=read&date=2026-09-11');
    expect(screen.getByRole('link', { name: 'Next day →' }).getAttribute('href')).toBe('/briefings?mode=read&date=2026-09-13');
  });
});

describe('read mode — sections', () => {
  it('renders Key Takeaways, Shape of the Day, Full Analysis and a rising-thread story link', () => {
    dailyValue = {
      ...fresh,
      brief: {
        ...fresh.brief,
        headline: 'Lead',
        summary: 'One. Two. Three.\n\nSecond paragraph.',
        categoryBreakdown: { conflict: 3, economy: 1 },
        risingThread: { title: 'Rising arc', threadId: 'thread-abc', oneLiner: 'It grows', trajectory: 'escalating' },
        topStories: [{ title: 'Story A', category: 'conflict', regions: ['France'], threadId: 'thread-a' }],
      },
    };
    renderAt('/briefings');
    expect(screen.getByText('★ Key Takeaways')).toBeInTheDocument();
    expect(screen.getByText(/Shape of the Day/)).toBeInTheDocument();
    expect(screen.getByText(/Full Analysis/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Rising arc/ }).getAttribute('href')).toBe('/weekly/thread/thread-abc');
    expect(screen.getByRole('link', { name: 'Story A' }).getAttribute('href')).toBe('/weekly/thread/thread-a');
    expect(screen.getByRole('link', { name: 'France' }).getAttribute('href')).toBe('/weekly/country/France');
  });

  it('a rising thread without a thread id is plain text, not a guessed link', () => {
    dailyValue = { ...fresh, brief: { ...fresh.brief, risingThread: { title: 'No id arc' } } };
    renderAt('/briefings');
    expect(screen.getByText('No id arc')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /No id arc/ })).toBeNull();
  });
});

describe('read mode — empty and error states', () => {
  it("no brief found: says it's a real gap rather than a same-day publish delay", () => {
    renderAt('/briefings');
    expect(screen.getByText(/No brief has been generated in the last month/i)).toBeInTheDocument();
  });

  it('a failed request is an error (reported, with a retry), not "no brief"', () => {
    const refetch = vi.fn();
    dailyValue = { brief: null, servedDateKey: null, loading: false, error: 'Proxy HTTP 502', refetch };
    renderAt('/briefings');
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/);
    expect(screen.queryByText(/No brief has been generated/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
    expect(reportFetchError).toHaveBeenCalledWith('briefings-daily', expect.any(Error));
  });
});

const weekly = {
  weekOf: '2026-10-11', asOf: '2026-10-11',
  signals: [
    { threadId: 'thread-w1', lede: 'Signal one', kind: 'threat', riskLevel: 'high', region: 'Sudan', asOf: '2026-10-10', fact: 'F1', soWhat: 'S1', related: 'thread two', sources: [{ source: 'www.reuters.com', url: 'https://reuters.com/x' }] },
  ],
  watch: [{ event: 'Vote', stake: 'stake', date: '2026-10-15' }],
};

describe('weekly mode', () => {
  it('renders KPIs, signals with sources and Related, the watch list and the method note', () => {
    weeklyValue = { brief: weekly, loading: false, error: null };
    renderAt('/briefings?mode=weekly');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The week’s signals, ranked by risk');
    expect(screen.getByText('Signals tracked')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'reuters.com' }).getAttribute('href')).toBe('https://reuters.com/x');
    expect(screen.getByText(/Related: thread two/)).toBeInTheDocument();
    expect(screen.getByText('Vote')).toBeInTheDocument();
    expect(screen.getByText(/Signals are selected by significance/)).toBeInTheDocument();
    expect(document.title).toMatch(/^Weekly Brief — week of /);
  });

  it('asks for ?week= and says so plainly when the API answers with a later (latest) edition', () => {
    weeklyValue = { brief: weekly, loading: false, error: null };
    renderAt('/briefings?mode=weekly&week=2026-10-04');
    expect(weeklyArgs).toContain('2026-10-04');
    expect(screen.getByText(/is not available here yet; showing the latest edition/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Week before' }).getAttribute('href')).toBe('/briefings?mode=weekly&week=2026-10-04');
    expect(screen.getByRole('link', { name: 'Latest edition →' }).getAttribute('href')).toBe('/briefings?mode=weekly');
  });

  it('a past week with no edition says so and offers the week before and the latest', () => {
    renderAt('/briefings?mode=weekly&week=2026-10-04');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/No weekly brief for the week of/);
    expect(screen.getByRole('link', { name: '← Week before' }).getAttribute('href')).toBe('/briefings?mode=weekly&week=2026-09-27');
    expect(screen.getByRole('link', { name: 'Latest edition →' }).getAttribute('href')).toBe('/briefings?mode=weekly');
  });

  it('no published brief is an honest empty state', () => {
    renderAt('/briefings?mode=weekly');
    expect(screen.getByText('No brief published yet')).toBeInTheDocument();
  });
});

describe('mode switch', () => {
  it('switching to Weekly writes ?mode=weekly and keeps no daily date', () => {
    dailyValue = fresh;
    weeklyValue = { brief: weekly, loading: false, error: null };
    renderAt(`/briefings?mode=read&date=${today}`);
    fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }));
    expect(screen.getByTestId('where').textContent).toBe('?mode=weekly');
  });
});
