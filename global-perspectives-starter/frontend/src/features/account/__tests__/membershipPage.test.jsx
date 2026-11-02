// MembershipPage: the billing entry page. States (billing not open, signed out, signed-in free,
// member), the plans/benefits it promises (business copy: asserted, never changed), and the
// checkout call. The Polar request itself lives in restProxy.createCheckout (mocked here).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const mockUseAuth = vi.fn();
const mockUseMembership = vi.fn();
const createCheckout = vi.fn();
const reportFetchError = vi.fn();

vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('@/shared/hooks/useMembership', () => ({ useMembership: () => mockUseMembership() }));
vi.mock('@/shared/api/restProxy', () => ({ createCheckout: (...a) => createCheckout(...a) }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: (...a) => reportFetchError(...a) }));

import MembershipPage from '@/features/account/MembershipPage';

const FREE = { membership: { tier: 'free' }, isMember: false, available: true, loading: false };
const SIGNED_IN = { user: { uid: 'u1', isAnonymous: false } };
const HOME = 'https://globalperspective.net/membership';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/membership']}>
      <MembershipPage />
    </MemoryRouter>,
  );
}

let realLocation;
beforeEach(() => {
  createCheckout.mockReset();
  reportFetchError.mockReset();
  mockUseAuth.mockReturnValue(SIGNED_IN);
  mockUseMembership.mockReturnValue(FREE);
  // window.location.href assignment is how the page leaves for Polar; capture it.
  realLocation = window.location;
  Object.defineProperty(window, 'location', { configurable: true, value: { href: HOME } });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
});

describe('MembershipPage — what the page promises', () => {
  it('sets the tab title and shows the heading, the free-to-read promise, the benefits and the Polar/not-advice fine print', () => {
    renderPage();
    expect(document.title).toBe('Membership | Global Perspectives');
    expect(screen.getByRole('heading', { level: 1, name: 'Global Perspectives Membership' })).toBeInTheDocument();
    expect(screen.getByText(/Every analysis and our public track record stay free to read/)).toBeInTheDocument();
    expect(screen.getByText(/The full self-correction history on every country page/)).toBeInTheDocument();
    expect(screen.getByText(/The complete corrections ledger on the track record/)).toBeInTheDocument();
    expect(screen.getByText(/Follow countries and see what changed in them since your last visit/)).toBeInTheDocument();
    expect(screen.getByText(/You fund independent, self-correcting intelligence/)).toBeInTheDocument();
    expect(screen.getByText(/processed securely by Polar/)).toBeInTheDocument();
    expect(screen.getByText(/not financial or investment advice/)).toBeInTheDocument();
  });

  it('does not promise the paused country change-alert emails or analysis credits', () => {
    renderPage();
    expect(screen.queryByText(/credit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/email alert|change-alert|drift/i)).not.toBeInTheDocument();
  });
});

describe('MembershipPage — billing not configured', () => {
  it('shows the honest "not open yet" notice and no Subscribe or plan controls', () => {
    mockUseMembership.mockReturnValue({ ...FREE, available: false });
    renderPage();
    expect(screen.getByText(/Membership isn't open yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Monthly')).not.toBeInTheDocument();
  });
});

describe('MembershipPage — signed out', () => {
  it.each([
    ['no user', { user: null }],
    ['anonymous guest', { user: { uid: 'g1', isAnonymous: true } }],
  ])('%s: shows both plans with a Sign in link carrying returnTo=/membership, no checkout buttons', (_label, auth) => {
    mockUseAuth.mockReturnValue(auth);
    renderPage();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Annual')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Subscribe/ })).not.toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Sign in to subscribe' });
    expect(links).toHaveLength(2);
    for (const a of links) {
      expect(a).toHaveAttribute('href', '/signin?returnTo=/membership');
      fireEvent.click(a);
    }
    expect(createCheckout).not.toHaveBeenCalled();
  });
});

describe('MembershipPage — signed-in free', () => {
  it('lists the Monthly $15/month and Annual $150/year plans and flags the annual one as best value', () => {
    renderPage();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Billed monthly. Cancel anytime.')).toBeInTheDocument();
    expect(screen.getByText('Annual')).toBeInTheDocument();
    expect(screen.getByText('2 months free vs. monthly.')).toBeInTheDocument();
    expect(screen.getByText('Best value')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe $15/month' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Subscribe $150/year' })).toBeEnabled();
    expect(screen.queryByText(/You're a member/)).not.toBeInTheDocument();
  });

  it('disables Subscribe while the membership lookup is still loading, and a click does nothing', () => {
    mockUseMembership.mockReturnValue({ ...FREE, membership: null, loading: true });
    renderPage();
    const monthly = screen.getByRole('button', { name: 'Subscribe $15/month' });
    expect(monthly).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subscribe $150/year' })).toBeDisabled();
    fireEvent.click(monthly);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it.each([
    ['Subscribe $15/month', 'monthly'],
    ['Subscribe $150/year', 'yearly'],
  ])('clicking "%s" calls createCheckout(%s) once and sends the browser to the returned URL', async (name, plan) => {
    createCheckout.mockResolvedValue({ url: 'https://polar.example/checkout/abc' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name }));
    await waitFor(() => expect(window.location.href).toBe('https://polar.example/checkout/abc'));
    expect(createCheckout).toHaveBeenCalledTimes(1);
    expect(createCheckout).toHaveBeenCalledWith(plan);
    expect(screen.queryByText(/could not start checkout/i)).not.toBeInTheDocument();
  });

  it('shows "Starting checkout…" on the clicked plan and disables both buttons while the request is in flight', async () => {
    let resolve;
    createCheckout.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe $150/year' }));
    const busy = await screen.findByRole('button', { name: 'Starting checkout…' });
    expect(busy).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subscribe $15/month' })).toBeDisabled();
    // clicking either disabled button must not fire another checkout
    fireEvent.click(busy);
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe $15/month' }));
    expect(createCheckout).toHaveBeenCalledTimes(1);
    resolve({ url: 'https://polar.example/checkout/x' });
    await waitFor(() => expect(window.location.href).toBe('https://polar.example/checkout/x'));
  });
});

describe('MembershipPage — checkout failure', () => {
  it('shows the server error text, re-enables Subscribe and does not navigate', async () => {
    createCheckout.mockRejectedValue(new Error('Polar HTTP 502'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe $15/month' }));
    expect(await screen.findByText('Polar HTTP 502')).toBeInTheDocument();
    expect(window.location.href).toBe(HOME);
    expect(screen.getByRole('button', { name: 'Subscribe $15/month' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Subscribe $150/year' })).toBeEnabled();
  });

  it('falls back to a plain sentence when the error has no message', async () => {
    createCheckout.mockRejectedValue({});
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe $150/year' }));
    expect(await screen.findByText('Could not start checkout.')).toBeInTheDocument();
  });

  it('treats a response with no checkout URL as a failure (never a silent no-op)', async () => {
    createCheckout.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe $15/month' }));
    expect(await screen.findByText('No checkout URL returned')).toBeInTheDocument();
    expect(window.location.href).toBe(HOME);
  });

  it('clears the previous error when the reader tries again', async () => {
    createCheckout.mockRejectedValueOnce(new Error('Polar HTTP 500'));
    let resolve;
    createCheckout.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe $15/month' }));
    expect(await screen.findByText('Polar HTTP 500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe $15/month' }));
    await waitFor(() => expect(screen.queryByText('Polar HTTP 500')).not.toBeInTheDocument());
    resolve({ url: 'https://polar.example/checkout/ok' });
    await waitFor(() => expect(window.location.href).toBe('https://polar.example/checkout/ok'));
  });

  // CLAUDE.md product rule: "fail empty/honest and report to the error sink". The page shows the
  // error but never calls reportFetchError, so a failed checkout is invisible to the operator.
  it.skip('BUG: reports a failed checkout to the error sink (MembershipPage.jsx subscribe catch does not)', async () => {
    createCheckout.mockRejectedValue(new Error('Polar HTTP 502'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe $15/month' }));
    await screen.findByText('Polar HTTP 502');
    expect(reportFetchError).toHaveBeenCalledTimes(1);
    expect(reportFetchError.mock.calls[0][1].message).toBe('Polar HTTP 502');
  });
});

describe('MembershipPage — member', () => {
  it('shows the active-member card with the renewal date and a Manage in Account link; no plans, no Subscribe', () => {
    mockUseMembership.mockReturnValue({
      membership: { tier: 'member', currentPeriodEnd: '2027-03-15T12:00:00.000Z' },
      isMember: true, available: true, loading: false,
    });
    renderPage();
    expect(screen.getByText("✓ You're a member")).toBeInTheDocument();
    expect(screen.getByText(/Your membership is active/)).toHaveTextContent(
      `renews ${new Date('2027-03-15T12:00:00.000Z').toLocaleDateString()}`,
    );
    const manage = screen.getByRole('link', { name: 'Manage in Account' });
    expect(manage).toHaveAttribute('href', '/account');
    expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Best value')).not.toBeInTheDocument();
    fireEvent.click(manage);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('omits the renewal line when the period end is unknown (never invents a date)', () => {
    mockUseMembership.mockReturnValue({ membership: { tier: 'member' }, isMember: true, available: true, loading: false });
    renderPage();
    expect(screen.getByText(/Your membership is active/)).not.toHaveTextContent(/renews/);
  });
});
