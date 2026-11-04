// Present mode, desktop: the arrow keys, the slide buttons and the slide chips all go through one
// path, and the map's focused country follows the slide whichever was used (BC F9: after ArrowLeft
// the slide changed but the globe stayed on the old country). The map is handed one fly-to at a
// time (useSettledFocus), so a burst of presses ends on the current slide's country (R2-1).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('@/shared/map/StoryMap.jsx', () => ({ default: ({ storyFocusIso3 }) => <div data-testid="map" data-focus={storyFocusIso3 || ''} /> }));
vi.mock('@/features/briefings/hooks/useStoryQuestion.js', () => ({ useStoryQuestion: () => null }));

import BriefingMode from '@/features/briefings/components/BriefingMode.jsx';

const dailyBrief = {
  headline: 'H', summary: 'S',
  topStories: [
    { title: 'Story one', category: 'conflict', iso3: ['USA'] },
    { title: 'Story two', category: 'conflict', iso3: ['UKR'] },
    { title: 'Story three', category: 'economy', iso3: ['FRA'] },
  ],
};
const focus = () => screen.getByTestId('map').getAttribute('data-focus');
const key = (k) => fireEvent.keyDown(window, { key: k });
// Lets a running fly-to finish (the map takes the next focus only after that).
const settle = () => act(() => { vi.advanceTimersByTime(1500); });
const setup = () => render(
  <MemoryRouter><BriefingMode mode="daily" onModeChange={vi.fn()} dailyBrief={dailyBrief} dailyEditionsIndex={{}} dailyAnchorDateKey="2026-11-03" newestDailyKey="2026-11-03" /></MemoryRouter>,
);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('BriefingMode slide stepping', () => {
  it('ArrowRight / ArrowLeft move the slide and the map focus together', async () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: 'STORY 3' }));
    expect(focus()).toBe('FRA');
    key('ArrowLeft');
    expect(screen.getByText('Story two')).toBeInTheDocument();
    await settle();
    expect(focus()).toBe('UKR');
    key('ArrowLeft');
    await settle();
    expect(focus()).toBe('USA');
    key('ArrowRight');
    await settle();
    expect(focus()).toBe('UKR');
  });

  it('the slide buttons and chips agree with the keys', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    await settle();
    expect(focus()).toBe('UKR');
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    await settle();
    expect(focus()).toBe('USA');
    fireEvent.click(screen.getByRole('tab', { name: 'THE DAY' }));
    await settle();
    expect(focus()).toBe('');
  });

  it('rapid presses hand the map one flight at a time and always end on the current slide', async () => {
    setup();
    key('ArrowRight');
    key('ArrowRight');
    key('ArrowRight');
    expect(screen.getByText('Story three')).toBeInTheDocument();
    expect(focus()).toBe('USA'); // the first flight starts at once; later targets wait for it
    await settle();
    expect(focus()).toBe('FRA'); // then the map goes straight to the slide's country, not one behind
    key('ArrowLeft');
    key('ArrowLeft');
    key('ArrowRight');
    expect(screen.getByText('Story two')).toBeInTheDocument();
    expect(focus()).toBe('FRA'); // a flight is still running
    await settle();
    expect(focus()).toBe('UKR');
  });

  it('an arrow key reaches no other listener (the globe\'s controller would pan and cancel the fly-to)', () => {
    setup();
    const inner = vi.fn();
    const probe = document.body.appendChild(document.createElement('div'));
    probe.addEventListener('keydown', inner);
    fireEvent.keyDown(probe, { key: 'ArrowRight' });
    expect(inner).not.toHaveBeenCalled();
    expect(screen.getByText('Story one')).toBeInTheDocument();
    probe.remove();
  });

  it('typing in a field or a browser shortcut does not step the slide', () => {
    setup();
    const input = document.body.appendChild(document.createElement('input'));
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
    expect(screen.queryByText('Story one')).toBeNull();
    expect(focus()).toBe('');
    input.remove();
  });
});
