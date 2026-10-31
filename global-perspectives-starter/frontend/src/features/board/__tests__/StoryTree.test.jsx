import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import StoryTree from '../components/StoryTree.jsx';
import { presentOf, isLate, forkOutcome, outcomeText, foldTrunk, inChapter } from '../lib/storyTree.js';
import storyA from '../dev/recordViews/story-a.json';
import storyB from '../dev/recordViews/story-b.json';
import storyC from '../dev/recordViews/story-c.json';
afterEach(cleanup);
const show = (story) => render(<MemoryRouter><StoryTree story={story} /></MemoryRouter>);
const rung = (n) => screen.getByRole('button', { name: new RegExp(`^Level ${n},`) });

describe('story tree zoom ladder', () => {
  it('missing story renders nothing', () => {
    const { container } = render(<StoryTree />);
    expect(container.textContent).toBe('');
  });
  it('an unread story has no rung 1 or 2, opens on rung 3 and keeps rung 4 disabled until an event is chosen', () => {
    show(storyA);
    expect(screen.queryByRole('button', { name: /^Level 1,/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Level 2,/ })).toBeNull();
    expect(rung(3)).toHaveAttribute('aria-pressed', 'true');
    expect(rung(4)).toBeDisabled();
    expect(screen.getByText('choose an event on the trunk')).toBeInTheDocument();
    expect(screen.getByText('ZOOM')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}T\d|DEAD|dead|did not happen|coming soon/);
  });
  it('story with a line opens on rung 1 with the counts; plus and minus step between the rungs it has', () => {
    show(storyC);
    expect(rung(1)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Closure is leverage/)).toBeInTheDocument();
    expect(screen.getByText('3 chapters · 5 events · 4 live branches')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(rung(2)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(rung(3)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
  });
  it('rung 2 shows chapter cards stamped with the reading week; opening one scopes rung 3 to that chapter', () => {
    show(storyC);
    fireEvent.click(rung(2));
    expect(screen.getAllByText('written week of 12 Oct · never rewritten')).toHaveLength(3); // reading week 2026-W42
    expect(screen.getByText('present · 18 Oct')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Harassment' }));
    expect(rung(3)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Harassment · opened')).toBeInTheDocument();
    const trunk = screen.getByText('Trunk').nextSibling;
    expect(within(trunk).getAllByRole('button').map((b) => b.textContent)).toEqual(['Harassment; insurers pull cover', 'Insurers resume cover for some routes']);
    fireEvent.click(screen.getByRole('button', { name: 'whole story' }));
    expect(within(screen.getByText('Trunk').nextSibling).getAllByRole('button')).toHaveLength(5);
  });
  it('a story whose reading carries no week shows no stamp', () => {
    show({ ...storyB, reading: { state: 'read' } });
    fireEvent.click(rung(2));
    expect(screen.getByText('Operators reroute')).toBeInTheDocument();
    expect(screen.queryByText(/never rewritten/)).toBeNull();
  });
  it('rung 3 draws the tree: present line, one line per open branch weighted by its percentage, late flag, key', () => {
    const { container } = show(storyC);
    fireEvent.click(rung(3));
    const svg = container.querySelector('svg.story-tree__svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.textContent).toContain('PRESENT · 18 OCT');
    const widths = [...svg.querySelectorAll('path.st-branch')].map((p) => Number(p.getAttribute('stroke-width')));
    expect(widths).toEqual([14, 22, 12, 6]);
    expect(svg.querySelectorAll('path.st-branch--late')).toHaveLength(1);
    expect(svg.textContent).toContain('▸ late · past 15 Oct');
    expect(screen.getByText(/OURS · PROVISIONAL/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Key' })).toBeInTheDocument();
  });
  it('older history folds into one button that unfolds the drawing', () => {
    const { container } = show(storyC);
    fireEvent.click(rung(3));
    const fold = screen.getByRole('button', { name: 'Before 21 Sep ▸' });
    expect(container.querySelectorAll('svg.story-tree__svg circle')).toHaveLength(4);
    fireEvent.click(fold);
    expect(container.querySelectorAll('svg.story-tree__svg circle')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Before 21 Sep ▾' })).toHaveAttribute('aria-expanded', 'true');
  });
  it('forks read as a person: closed forks count their outcomes, open forks are provisional, a late branch is flagged, never dead', () => {
    show(storyC);
    fireEvent.click(rung(3));
    expect(screen.getByText('21 Sep fork · closed')).toBeInTheDocument();
    expect(screen.getByText('3 branches · 1 happened · 1 not reported · 1 late')).toBeInTheDocument();
    expect(screen.getByText('open fork · 16 Oct · provisional')).toBeInTheDocument();
    expect(screen.getByText('IRGC reopening statement · 35% · open · due 15 Oct')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/dead/i);
  });
  it('no entries and no forks give one line and no drawing', () => {
    const { container } = show({ ...storyA, entries: [], forks: [] });
    expect(screen.getByText('No dated event or forecast branch has been recorded for this story.')).toBeInTheDocument();
    expect(screen.queryByText('Trunk')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });
  it('a branch row shows label, p, status and its trigger on a second line', () => {
    const { container } = show({ ...storyA, forks: [{ forkId: 'f', drawnAt: '2026-09-30T12:26:28.689Z', branches: [{ branchId: 'x', text: 'Most Likely', p: 25, trigger: 'Insurers announce a surcharge', due: '2026-11-30' }] }] });
    expect(screen.getByText('open fork · 30 Sep · provisional')).toBeInTheDocument();
    expect(screen.getByText('Most Likely · 25% · open · due 30 Nov')).toBeInTheDocument();
    expect(container.querySelector('summary .board-branch__text').textContent).toBe('Insurers announce a surcharge');
  });
  it('choosing an event opens rung 4: sources, the branches drawn that day, a link to the story page; recovered rows are labelled', () => {
    show(storyA);
    expect(screen.getAllByText(/recovered from public records/)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Strait traffic thins as insurers react' }));
    expect(rung(4)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/recovered from public records · A headline recovered/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Example Wire' })).toHaveAttribute('href', 'https://example.org/c');
    expect(screen.getByRole('link', { name: 'Open story page' })).toHaveAttribute('href', '/weekly/thread/story-a');
    cleanup();
    show(storyC);
    fireEvent.click(rung(3));
    fireEvent.click(screen.getByRole('button', { name: 'First strikes' }));
    expect(screen.getByRole('link', { name: 'Al Jazeera' })).toHaveAttribute('href', 'https://example.org/c4');
    expect(screen.getByText('Branches drawn this day')).toBeInTheDocument();
    expect(screen.getByText('Another vessel struck · 45%')).toBeInTheDocument();
  });
  it('verdict wording on branches stays in branchWording', () => {
    show(storyA);
    expect(screen.getByText('Premiums rise again · 65% · happened · 20 Oct')).toBeInTheDocument();
    expect(screen.getByText(/“Second insurer raises premiums”/)).toBeInTheDocument();
    expect(screen.getByText('Talks restart · 10% · not reported by 12 Oct')).toBeInTheDocument();
    expect(screen.getByText('Sanctions eased · 5% · could not be checked · the source was unavailable')).toBeInTheDocument();
    expect(screen.getByText('Old question · recorded before scoring began')).toBeInTheDocument();
  });
});

describe('storyTree helpers', () => {
  it('present is the facts-through day; late needs an open branch past its due day', () => {
    expect(presentOf(storyC)).toBe('2026-10-18');
    expect(presentOf({})).toBe('');
    const open = { due: '2026-10-15', verdict: null };
    expect(isLate(open, '2026-10-18')).toBe(true);
    expect(isLate(open, '')).toBe(false);
    expect(isLate({ ...open, verdict: { result: 'no' } }, '2026-10-18')).toBe(false);
    expect(isLate({ ...open, legacy: true }, '2026-10-18')).toBe(false);
  });
  it('outcome counts leave out zero parts', () => {
    expect(outcomeText(forkOutcome(storyC.forks[0], '2026-10-18'))).toBe('3 branches · 1 happened · 2 not reported');
    expect(outcomeText(forkOutcome({ branches: [{ due: '2026-11-01' }] }, '2026-10-18'))).toBe('1 branch · 1 open');
  });
  it('fold keeps the last four; chapters scope events and forks by date', () => {
    const { shown, folded } = foldTrunk(storyC.entries, storyC.forks);
    expect(shown).toHaveLength(4);
    expect(folded).toEqual({ before: '2026-09-21', branches: 0, taken: 0 });
    expect(foldTrunk(storyC.entries.slice(0, 3), storyC.forks).folded).toBeNull();
    const c = inChapter(storyC, storyC.chapters[2]);
    expect(c.entries.map((e) => e.eventId)).toEqual(['c4', 'c5']);
    expect(c.forks.map((f) => f.forkId)).toEqual(['cf2', 'cf3']);
  });
});

describe('weekMonday', () => {
  it('turns an ISO week into its Monday; anything else is null', async () => {
    const { weekMonday } = await import('@/features/board/lib/recordViews.js');
    expect(weekMonday('2026-W42')).toBe('2026-10-12');
    expect(weekMonday('2026-W01')).toBe('2025-12-29');
    expect(weekMonday('2026-10-12')).toBeNull();
    expect(weekMonday(undefined)).toBeNull();
  });
});
