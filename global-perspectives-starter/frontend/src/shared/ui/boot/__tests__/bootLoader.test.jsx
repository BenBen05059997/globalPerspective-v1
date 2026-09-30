import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import BootLoader, { failureLine } from '@/shared/ui/boot/BootLoader.jsx';
import { removeStaticBoot, endFullBoot } from '@/shared/ui/boot/staticBoot.js';

const S = (news, disaster, map) => [
  { id: 'news', label: 'News desk', state: news },
  { id: 'disaster', label: 'Disaster alerts', state: disaster },
  { id: 'map', label: 'Map', state: map },
];

afterEach(() => { cleanup(); vi.useRealTimers(); document.body.innerHTML = ''; });

describe('BootLoader states', () => {
  it('shows each sensor exactly as the prop says', () => {
    render(<BootLoader sensors={S('ok', 'wait', 'fail')} />);
    expect(screen.getByText('News desk').nextSibling).toHaveTextContent('✓ READY');
    expect(screen.getByText('Disaster alerts').nextSibling).toHaveTextContent('CONNECTING');
    expect(screen.getByText('Map').nextSibling).toHaveTextContent('NOT LOADED');
  });

  it('does not tick on its own: all-wait stays all-wait after any amount of time', () => {
    vi.useFakeTimers();
    render(<BootLoader sensors={S('wait', 'wait', 'wait')} />);
    act(() => { vi.advanceTimersByTime(60000); });
    expect(screen.getAllByText('CONNECTING')).toHaveLength(3);
    expect(screen.queryByText(/READY/)).toBeNull();
  });

  it('compact variant (no sensors) is just the mark + sweep, no sensor list, no buttons', () => {
    const { container } = render(<BootLoader variant="inline" tone="light" />);
    expect(container.querySelector('.gp-boot__globe')).toBeTruthy();
    expect(container.querySelector('.gp-boot__sensors')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.firstChild.className).toMatch(/gp-boot--inline/);
    expect(container.firstChild.className).not.toMatch(/gp-console/);
  });

  it('dark tone carries the console token scope', () => {
    const { container } = render(<BootLoader sensors={S('wait', 'wait', 'wait')} tone="dark" />);
    expect(container.firstChild.className).toMatch(/gp-console/);
  });

  it('marks itself ready (fill + crossfade) only when every sensor is ok, and calls onDone at transition end', () => {
    const onDone = vi.fn();
    const { container, rerender } = render(<BootLoader sensors={S('ok', 'ok', 'wait')} onDone={onDone} />);
    expect(container.firstChild.className).not.toMatch(/gp-boot--ready/);
    rerender(<BootLoader sensors={S('ok', 'ok', 'ok')} onDone={onDone} />);
    expect(container.firstChild.className).toMatch(/gp-boot--ready/);
    fireEvent.transitionEnd(container.firstChild, { propertyName: 'opacity' });
    fireEvent.transitionEnd(container.firstChild, { propertyName: 'opacity' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('BootLoader slow note', () => {
  it('appears after slowAfterMs while something is still pending, and not before', () => {
    vi.useFakeTimers();
    render(<BootLoader sensors={S('ok', 'wait', 'wait')} slowAfterMs={8000} />);
    act(() => { vi.advanceTimersByTime(7999); });
    expect(screen.queryByText('Still connecting: slow network')).toBeNull();
    act(() => { vi.advanceTimersByTime(2); });
    expect(screen.getByText('Still connecting: slow network')).toBeInTheDocument();
  });

  it('defaults to 8 s and also shows on the compact variant', () => {
    vi.useFakeTimers();
    render(<BootLoader variant="inline" tone="light" />);
    act(() => { vi.advanceTimersByTime(7900); });
    expect(screen.queryByText(/slow network/)).toBeNull();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText(/slow network/)).toBeInTheDocument();
  });

  it('goes away once nothing is pending', () => {
    vi.useFakeTimers();
    const { rerender } = render(<BootLoader sensors={S('ok', 'wait', 'ok')} slowAfterMs={100} />);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText(/slow network/)).toBeInTheDocument();
    rerender(<BootLoader sensors={S('ok', 'ok', 'ok')} slowAfterMs={100} />);
    expect(screen.queryByText(/slow network/)).toBeNull();
  });
});

describe('BootLoader failure + retry', () => {
  it('words the failure from which sensors actually failed', () => {
    expect(failureLine(S('ok', 'fail', 'ok'))).toBe("Disaster alerts didn't load. News desk and Map are ready.");
    expect(failureLine(S('fail', 'fail', 'ok'))).toBe("News desk and Disaster alerts didn't load. Map is ready.");
    expect(failureLine(S('fail', 'fail', 'fail'))).toBe("News desk, Disaster alerts and Map didn't load.");
    expect(failureLine(S('ok', 'ok', 'ok'))).toBe('');
  });

  it('shows the honest line and a real >=44px RETRY button that calls onRetry', () => {
    const onRetry = vi.fn();
    const onContinue = vi.fn();
    render(<BootLoader sensors={S('ok', 'fail', 'ok')} onRetry={onRetry} onContinue={onContinue} />);
    expect(screen.getByText("Disaster alerts didn't load. News desk and Map are ready.")).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'RETRY' });
    expect(btn.tagName).toBe('BUTTON');
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'OPEN ANYWAY' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('does not show a failure line while another sensor is still connecting', () => {
    render(<BootLoader sensors={S('fail', 'wait', 'ok')} onRetry={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/didn't load/)).toBeNull();
  });

  it('no failure UI when nothing failed', () => {
    render(<BootLoader sensors={S('ok', 'ok', 'wait')} onRetry={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('static boot handoff', () => {
  it('removes the pre-JS #gp-boot node on the first React commit, and leaves nothing behind', () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="gp-boot" class="gp-boot"></div>');
    expect(document.getElementById('gp-boot')).toBeTruthy();
    render(<BootLoader variant="inline" tone="light" />);
    expect(document.getElementById('gp-boot')).toBeNull();
  });

  it('removeStaticBoot is a safe no-op when there is no node', () => {
    expect(() => removeStaticBoot()).not.toThrow();
  });

  it('the React copy never carries the static id (so it can never be removed by mistake)', () => {
    const { container } = render(<BootLoader variant="inline" />);
    expect(container.querySelector('#gp-boot')).toBeNull();
  });
});

describe('reduced motion', () => {
  it('finishes immediately (no crossfade to wait for) when the visitor prefers reduced motion', () => {
    const orig = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const onDone = vi.fn();
    render(<BootLoader sensors={S('ok', 'ok', 'ok')} onDone={onDone} />);
    window.matchMedia = orig;
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('slow note counts from page load when the full pre-JS boot was handed off', () => {
  it('fires slowAfterMs after LOAD, not after React mounted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    document.body.insertAdjacentHTML('beforeend', '<div id="gp-boot" class="gp-boot gp-boot--full"></div>');
    vi.spyOn(performance, 'now').mockReturnValue(6000); // the visitor has already waited 6 s
    render(<BootLoader sensors={S('wait', 'wait', 'wait')} slowAfterMs={8000} />);
    act(() => { vi.advanceTimersByTime(1900); });
    expect(screen.queryByText(/slow network/)).toBeNull();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText(/slow network/)).toBeInTheDocument();
    performance.now.mockRestore();
    endFullBoot();
  });
});
