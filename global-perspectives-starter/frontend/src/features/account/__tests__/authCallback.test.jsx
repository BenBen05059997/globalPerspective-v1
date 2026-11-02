// AuthCallback: the page a magic-link email lands on. It hands the full URL to the auth context's
// completeSignIn, then redirects to the ?returnTo= captured at sign-in (localStorage gp_return_to)
// or /weekly; a failure shows an honest "Sign-in failed" panel with a Try again link.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const mockUseAuth = vi.fn();
const completeSignIn = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

import AuthCallback from '@/features/account/AuthCallback';

const LINK_PATH = '/auth/callback?apiKey=k&oobCode=abc123&mode=signIn';

function renderCallback() {
  return render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <AuthCallback />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  completeSignIn.mockReset();
  mockNavigate.mockReset();
  mockUseAuth.mockReset();
  mockUseAuth.mockReturnValue({ completeSignIn, user: null });
  window.history.pushState({}, '', LINK_PATH);
  localStorage.clear();
  sessionStorage.clear();
});

describe('AuthCallback — success', () => {
  it('passes the full link URL to completeSignIn, then redirects to /weekly (replace) when no returnTo was captured', async () => {
    completeSignIn.mockResolvedValue({ uid: 'u1' });
    renderCallback();
    // while the link is being finished, the inline loader says so and no failure panel shows
    expect(screen.getByText('Signing you in')).toBeInTheDocument();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(completeSignIn).toHaveBeenCalledTimes(1);
    expect(completeSignIn).toHaveBeenCalledWith(window.location.href);
    expect(window.location.href).toContain('oobCode=abc123');
    expect(mockNavigate).toHaveBeenCalledWith('/weekly', { replace: true });
    expect(sessionStorage.getItem('gp_just_signed_in')).toBe('1');
    expect(screen.queryByText('Sign-in failed')).not.toBeInTheDocument();
  });

  it('honors the returnTo captured at sign-in (membership funnel) and clears it so it is used once', async () => {
    localStorage.setItem('gp_return_to', '/membership');
    completeSignIn.mockResolvedValue({ uid: 'u1' });
    renderCallback();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/membership', { replace: true }));
    expect(localStorage.getItem('gp_return_to')).toBeNull();
  });
});

describe('AuthCallback — failure', () => {
  it.each([
    ['an invalid or expired link', 'Invalid sign-in link'],
    ['a missing email', 'Email required to complete sign-in'],
    ['an unconfigured Firebase', 'Firebase not configured'],
  ])('%s: shows "Sign-in failed" with the real reason and a Try again link to /signin; never navigates or marks signed in', async (_label, message) => {
    localStorage.setItem('gp_return_to', '/membership');
    window.history.pushState({}, '', '/auth/callback');
    completeSignIn.mockRejectedValue(new Error(message));
    renderCallback();
    expect(await screen.findByRole('heading', { name: 'Sign-in failed' })).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    const retry = screen.getByRole('link', { name: 'Try again' });
    expect(retry).toHaveAttribute('href', '/signin');
    fireEvent.click(retry);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('gp_just_signed_in')).toBeNull();
    // the captured returnTo survives a failed attempt so the retry still lands where the reader wanted
    expect(localStorage.getItem('gp_return_to')).toBe('/membership');
    expect(screen.queryByText('Signing you in')).not.toBeInTheDocument();
  });

  it('falls back to a plain sentence when the failure has no message', async () => {
    completeSignIn.mockRejectedValue({});
    renderCallback();
    expect(await screen.findByText('Sign-in failed. The link may have expired.')).toBeInTheDocument();
  });
});

describe('AuthCallback — already signed in', () => {
  it('still finishes the link and redirects (the page does not short-circuit on an existing session)', async () => {
    mockUseAuth.mockReturnValue({ completeSignIn, user: { uid: 'u1', isAnonymous: false } });
    completeSignIn.mockResolvedValue({ uid: 'u1' });
    renderCallback();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/weekly', { replace: true }));
    expect(completeSignIn).toHaveBeenCalledTimes(1);
  });

  it('shows the failure panel (not a redirect) when a signed-in visitor opens the page without a valid link', async () => {
    mockUseAuth.mockReturnValue({ completeSignIn, user: { uid: 'u1', isAnonymous: false } });
    window.history.pushState({}, '', '/auth/callback');
    completeSignIn.mockRejectedValue(new Error('Invalid sign-in link'));
    renderCallback();
    expect(await screen.findByRole('heading', { name: 'Sign-in failed' })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
