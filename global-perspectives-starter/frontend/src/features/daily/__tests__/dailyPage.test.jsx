// DailyPage wording (F4, review R2): "Today's Brief" only when the shown edition really is
// today's; a plain, true "no new brief" line instead of "publishes at the end of the day" during
// an outage; and "AI-generated" only (no human-review step is evidenced in the repo).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

vi.mock('@/features/economy/hooks/useDisruptionsList', () => ({
  useDisruptionsList: () => ({ data: [], loading: false, error: null }),
}));

let briefValue;
vi.mock('@/features/daily/hooks/useDailyBrief', () => ({
  useDailyBrief: () => briefValue,
}));

import DailyPage from '@/features/daily/DailyPage';

function renderDaily(path = '/daily') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/daily/:dateKey" element={<DailyPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  briefValue = null;
});

describe('DailyPage — masthead heading', () => {
  it('shows "Today\'s Brief" when the served edition is today\'s', () => {
    briefValue = {
      brief: { displayDate: today, generatedAt: new Date().toISOString(), summary: '' },
      servedDateKey: today,
      loading: false,
    };
    renderDaily('/daily');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Today's Brief");
  });

  it('shows "Latest Brief · <date>" when the served edition is older than today (analysis paused)', () => {
    const old = '2026-09-12';
    briefValue = {
      brief: { displayDate: old, generatedAt: new Date(old).toISOString(), summary: '' },
      servedDateKey: old,
      loading: false,
    };
    renderDaily('/daily');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/Latest Brief/);
    expect(h1.textContent).toContain(old);
    expect(h1.textContent).not.toMatch(/Today's Brief/);
  });
});

describe('DailyPage — fallback note when today\'s edition is not out', () => {
  it('says "No new brief since <date> while analysis is paused" instead of implying a same-day delay', () => {
    const old = '2026-09-12';
    briefValue = {
      brief: { displayDate: old, generatedAt: new Date(old).toISOString(), summary: '' },
      servedDateKey: old,
      loading: false,
    };
    renderDaily('/daily');
    expect(screen.getByText(/No new brief since/)).toBeInTheDocument();
    expect(screen.queryByText(/publishes at the end of the day/i)).not.toBeInTheDocument();
  });
});

describe('DailyPage — AI-generated badge', () => {
  it('shows "AI-generated" only, no "analyst-reviewed" claim', () => {
    briefValue = {
      brief: { displayDate: today, generatedAt: new Date().toISOString(), summary: '' },
      servedDateKey: today,
      loading: false,
    };
    renderDaily('/daily');
    expect(screen.getByText('AI-generated')).toBeInTheDocument();
    expect(screen.queryByText(/analyst-reviewed/i)).not.toBeInTheDocument();
  });
});

describe('DailyPage — no brief found', () => {
  it("says it's a real gap rather than a same-day publish delay", () => {
    briefValue = { brief: null, servedDateKey: null, loading: false };
    renderDaily('/daily');
    expect(screen.getByText(/No brief has been generated in the last month/i)).toBeInTheDocument();
    expect(screen.queryByText(/publishes at the end of the day/i)).not.toBeInTheDocument();
  });
});
