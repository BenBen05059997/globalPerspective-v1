// Present mode, desktop: the arrow keys, the slide buttons and the slide chips all go through one
// path, and the map's focused country follows the slide whichever was used (BC F9: after ArrowLeft
// the slide changed but the globe stayed on the old country).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
const setup = () => render(
  <MemoryRouter><BriefingMode mode="daily" onModeChange={vi.fn()} dailyBrief={dailyBrief} dailyEditionsIndex={{}} dailyAnchorDateKey="2026-11-03" newestDailyKey="2026-11-03" /></MemoryRouter>,
);

describe('BriefingMode slide stepping', () => {
  it('ArrowRight / ArrowLeft move the slide and the map focus together', () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: 'STORY 3' }));
    expect(focus()).toBe('FRA');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Story two')).toBeInTheDocument();
    expect(focus()).toBe('UKR');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(focus()).toBe('USA');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(focus()).toBe('UKR');
  });

  it('the slide buttons and chips agree with the keys', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(focus()).toBe('UKR');
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(focus()).toBe('USA');
    fireEvent.click(screen.getByRole('tab', { name: 'THE DAY' }));
    expect(focus()).toBe('');
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
