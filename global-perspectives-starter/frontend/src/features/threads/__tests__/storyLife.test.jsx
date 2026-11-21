import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
const H = vi.hoisted(() => ({ line: null }));
vi.mock('@/shared/hooks/useStoryLinkLine', () => ({ useStoryLinkLine: () => H.line }));

import StoryLife from '@/features/threads/components/StoryLife.jsx';
import { storyStamp } from '@/features/threads/hooks/useNarrativeThread';

const entry = (i, over = {}) => ({ topicId: `t${i}`, date: `2026-11-${String(i).padStart(2, '0')}`, title: `Step ${i}`, sources: [{}, {}], role: 'move', ...over });
const thread = (n) => ({ entries: Array.from({ length: n }, (_, k) => entry(k + 1, k === 0 ? { role: 'start' } : {})).reverse(), regions: ['Ukraine', 'Russia'] });
const stamp = { born: '2026-11-01', stepCount: 14, stepDays: 12, outletCount: 9, firstStep: { date: '2026-11-01', title: 'Step 1', role: 'start' } };
const mount = (props) => render(<MemoryRouter><StoryLife displayTitle="Step 14" category="conflict" analysis={{ watchQuestions: ['Q one?', 'Q two?'], riskScore: 82 }} stamp={stamp} isPhone={false} {...props} /></MemoryRouter>);

describe('StoryLife (story page top, SPEC §4)', () => {
  it('desktop: since line from the stamps, Began on the first step, a fold past 12 steps, the newest step line, all questions, outlets', () => {
    mount({ thread: thread(14) });
    expect(screen.getByText('A story we follow since Nov 1 · 14 steps on 12 days')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Step 14' })).toBeInTheDocument();
    const items = [...document.querySelectorAll('.sl-steps > li')].map((li) => li.textContent);
    expect(items[0]).toBe('Nov 1Began: Step 1');
    expect(items[1]).toBe('Show the 8 steps in between ▾');
    expect(items.at(-1)).toBe('Nov 14Moves a story Newest step: the headline above · 2 sources');
    expect(items).toHaveLength(7); // first, fold, last 5
    fireEvent.click(screen.getByRole('button', { name: 'Show the 8 steps in between ▾' }));
    expect(document.querySelectorAll('.sl-steps > li')).toHaveLength(14);
    const watch = document.querySelector('.gp-watch');
    expect(within(watch).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Q one?', 'Q two?']);
    expect(screen.getByText('9 outlets across 14 steps')).toBeInTheDocument();
    expect(document.querySelector('.sl-side').textContent).toContain('How serious: High 82 of 100 (our model’s rating)');
  });

  it('first-step label follows the stamped firstStep.role: null says "Earliest step in our record:" and "in our record since"; measure has its own label', () => {
    const { unmount } = mount({ thread: thread(3), stamp: { ...stamp, stepCount: 3, firstStep: { ...stamp.firstStep, role: null } } });
    expect(screen.getByText('A story in our record since Nov 1 · 3 steps on 12 days')).toBeInTheDocument();
    expect(document.querySelector('.sl-steps > li').textContent).toBe('Nov 1Earliest step in our record: Step 1');
    unmount();
    mount({ thread: thread(3), stamp: { ...stamp, stepCount: 3, firstStep: { ...stamp.firstStep, role: 'measure' } } });
    expect(document.querySelector('.sl-steps > li').textContent).toBe('Nov 1First step: Step 1');
  });

  it('a first step cut from the rows (400-row cap) is drawn from the stamp', () => {
    mount({ thread: thread(3), stamp: { ...stamp, stepCount: 4, firstStep: { date: '2026-10-20', title: 'The real start', role: 'start' } } });
    expect(document.querySelector('.sl-steps > li').textContent).toBe('Oct 20Began: The real start');
  });

  it('phone: the first, a fold, the newest; one question and a fold for the rest', () => {
    mount({ thread: thread(4), isPhone: true });
    expect([...document.querySelectorAll('.sl-steps > li')]).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Show the 2 steps in between ▾' })).toBeInTheDocument();
    expect(within(document.querySelector('.gp-watch')).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '1 more question ▾' }));
    expect(within(document.querySelector('.gp-watch')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('a one-step story: the label sits on the only line, which points at the h1 (R6); no stamps: the null label, no since line and no outlets line; no questions: no box', () => {
    mount({ thread: thread(1), stamp: null, analysis: null });
    expect([...document.querySelectorAll('.sl-steps > li')].map((li) => li.textContent)).toEqual(['Nov 1Starts a story Earliest step in our record: the headline above · 2 sources']);
    expect(document.querySelector('.sl-since')).toBeNull();
    expect(document.querySelector('.gp-watch')).toBeNull();
    expect(screen.queryByText(/outlets across/)).toBeNull();
  });

  it('with a name: the h1 is the name and its tag; the newest step line carries the headline', () => {
    mount({ thread: thread(3), stamp: { ...stamp, stepCount: 3 }, name: 'Bridge war' });
    expect(document.querySelector('.sl-title').textContent).toBe('Bridge warMODEL JUDGMENT');
    expect(document.querySelectorAll('.sl-steps > li')[2].textContent).toBe('Nov 3Moves a story Step 3 · 2 sources');
  });

  it('rows of one day in either order: the stamped first and newest steps go to the ends', () => {
    const rows = [entry(1, { eventId: 'b', title: 'Rival bids', role: 'move' }), entry(1, { eventId: 'a', title: 'Route announced', role: 'start' })];
    mount({ thread: { entries: rows, regions: [] }, stamp: { ...stamp, stepCount: 2, firstStep: { eventId: 'a', date: '2026-11-01', title: 'Route announced', role: 'start' }, newestStep: { eventId: 'b' } } });
    expect([...document.querySelectorAll('.sl-steps > li')].map((li) => li.textContent)).toEqual(['Nov 1Began: Route announced', 'Nov 1Moves a story Newest step: the headline above · 2 sources']);
  });

  it('storyStamp keeps the stamped fields and nulls the missing ones', () => {
    expect(storyStamp({ born: '2026-11-01', sourceIds: ['a', 'b'] })).toEqual({ id: null, name: null, born: '2026-11-01', stepCount: null, stepDays: null, firstStep: null, newestStep: null, mergedFrom: [], outletCount: 2 });
    expect(storyStamp({ threadId: 'S', merges: [{ from: 'A', into: 'S' }, { from: 'A', into: 'S' }, { from: 'Z', into: 'other' }] }).mergedFrom).toEqual(['A']); // the stories merged into this one
    expect(storyStamp(null)).toBeNull();
  });

  it('top of the page: the newest step\'s kind chip beside the category; a forecast line chance first; one link line; the board button; the step list is unchanged', () => {
    H.line = { dir: 'feeds', otherId: 'thread-egypt', title: 'Egypt approves support', strength: 'medium', confirmed: true };
    const forecast = { scenarios: [{ label: 'S', triggers: [{ question: true, p: 22, text: 'Poland invokes Article 4', deadline: '2099-12-20', state: null, verdict: null }] }] };
    mount({ thread: thread(3), forecast, threadId: 'thread-a', board: { href: '/board?theme=theme-a', count: 6 } });
    const where = document.querySelector('.sl-where');
    expect(where.querySelector('.gp-kind').textContent).toBe('Moves a story');
    expect(document.querySelector('.sl-forecast').textContent).toBe('22% that Poland invokes Article 4, by Dec 20');
    const line = screen.getByTestId('story-link-line');
    expect(line.textContent).toContain('→ feeds into');
    expect(line.textContent).toContain('Egypt approves support');
    expect(line.textContent).toContain('confirmed in our weekly review');
    expect(screen.getByRole('link', { name: /Open the story’s board · 6 stories/ })).toHaveAttribute('href', '/board?theme=theme-a');
    const order = [...document.querySelectorAll('.sl-title, .sl-forecast, .gp-linkline, .sl-board, .sl-steps')].map((e) => e.className.split(' ')[0]);
    expect(order).toEqual(['sl-title', 'sl-forecast', 'gp-linkline', 'sl-board', 'sl-steps']);
    expect(document.querySelectorAll('.sl-steps > li')).toHaveLength(3);
  });

  it('no forecast, no link, no board: those lines are absent (no placeholder)', () => {
    H.line = null;
    mount({ thread: thread(3), forecast: null });
    expect(document.querySelector('.sl-forecast')).toBeNull();
    expect(screen.queryByTestId('story-link-line')).toBeNull();
    expect(document.querySelector('.sl-board')).toBeNull();
  });
});
