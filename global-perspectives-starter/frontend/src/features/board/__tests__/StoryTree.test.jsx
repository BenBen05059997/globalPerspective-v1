import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import StoryTree from '../components/StoryTree.jsx';
import { factsThrough, isLate, forkOutcome, outcomeText, foldTrunk, inChapter, drawnBranches } from '../lib/storyTree.js';
import storyA from '../dev/recordViews/story-a.json';
import storyB from '../dev/recordViews/story-b.json';
import storyC from '../dev/recordViews/story-c.json';
afterEach(cleanup);
const TODAY = '2026-10-18'; // the day storyC's facts run to
const show = (story, today = TODAY) => render(<MemoryRouter><StoryTree story={story} today={today} /></MemoryRouter>);
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
    expect(screen.getByText('3 chapters · 5 events · 3 live branches · 1 late')).toBeInTheDocument();
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
    expect(widths).toEqual([22, 12]); // only the newest open fork is drawn, and its 15% branch starts folded
    expect(screen.getByRole('button', { name: '1 branch under 20% folded ▸' })).toBeInTheDocument();
    expect(svg.querySelectorAll('path.st-branch--late')).toHaveLength(0);
    expect(screen.getByText(/OURS · PROVISIONAL/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Key' })).toBeInTheDocument();
  });
  it('older history folds into one button that unfolds the drawing', () => {
    const { container } = show(storyC);
    fireEvent.click(rung(3));
    const fold = screen.getByRole('button', { name: 'Before 21 Sep · 1 event ▸' });
    expect(container.querySelectorAll('svg.story-tree__svg circle')).toHaveLength(4);
    fireEvent.click(fold);
    expect(container.querySelectorAll('svg.story-tree__svg circle')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Before 21 Sep · 1 event ▾' })).toHaveAttribute('aria-expanded', 'true');
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
    expect(screen.getByText('Insurers announce a surcharge · 25% · open · due 30 Nov')).toBeInTheDocument();
    expect(container.querySelector('summary .board-branch__text').textContent).toBe('Most Likely');
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
    expect(screen.getByText('A vessel struck before 16 Oct · 45%')).toBeInTheDocument();
  });
  it('verdict wording on branches stays in branchWording', () => {
    show(storyA);
    expect(screen.getByText('A second insurer announces an increase · 65% · happened · 20 Oct')).toBeInTheDocument();
    expect(screen.getByText(/“Second insurer raises premiums”/)).toBeInTheDocument();
    expect(screen.getByText('Talks restart · 10% · not reported by 12 Oct')).toBeInTheDocument();
    expect(screen.getByText('Sanctions eased · 5% · could not be checked · the source was unavailable')).toBeInTheDocument();
    expect(screen.getByText('Old · recorded before scoring began')).toBeInTheDocument();
  });
});

describe('storyTree helpers', () => {
  it('facts-through is the story\'s data day; late needs an open branch past its due day', () => {
    expect(factsThrough(storyC)).toBe('2026-10-18');
    expect(factsThrough({})).toBe('');
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
  it('fold hides events more than 4 weeks before the present; chapters scope events and forks by date', () => {
    const { shown, folded } = foldTrunk(storyC.entries, storyC.forks, '2026-10-18');
    expect(shown).toHaveLength(4);
    expect(folded).toEqual({ before: '2026-09-21', events: 1, branches: 0, taken: 0 });
    expect(foldTrunk(storyC.entries.slice(1), storyC.forks, '2026-10-18').folded).toBeNull();
    expect(foldTrunk(storyC.entries, storyC.forks).folded).toBeNull(); // no present: nothing folds
    expect(foldTrunk(storyC.entries, storyC.forks, '2027-01-01').shown.map((e) => e.date)).toEqual(['2026-10-16']); // all old: the newest stays
    const c = inChapter(storyC, storyC.chapters[2]);
    expect(c.entries.map((e) => e.eventId)).toEqual(['c4', 'c5']);
    expect(c.forks.map((f) => f.forkId)).toEqual(['cf2', 'cf3']);
  });
});

describe('the tree reads today, not the facts day', () => {
  it('the present line and the late flags use today (UTC); a note says where the facts stop', () => {
    const { container } = show(storyC, '2026-10-20');
    fireEvent.click(rung(3));
    expect(container.querySelector('svg.story-tree__svg').textContent).toContain('PRESENT · 20 OCT');
    expect(screen.getByText('Facts run to 18 Oct.')).toBeInTheDocument();
  });
  it('a branch under 20% starts folded and is drawn once the reader unfolds it', () => {
    const forks = [{ forkId: 'f', drawnAt: '2026-10-10', branches: [
      { branchId: 'a', text: 'High', p: 60, due: '2026-12-01' }, { branchId: 'b', text: 'Low', p: 10, due: '2026-12-01' }, { branchId: 'c', text: 'Settled', p: 5, verdict: { result: 'no', at: '2026-10-12' } }] }];
    expect(drawnBranches(forks)).toEqual({ shown: [forks[0].branches[0]], folded: 1, low: 1 });
    expect(drawnBranches(forks, true).shown.map((b) => b.branchId)).toEqual(['a', 'b']);
    const { container } = show({ ...storyA, forks });
    expect(container.querySelectorAll('path.st-branch')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '1 branch under 20% folded ▸' }));
    expect(container.querySelectorAll('path.st-branch')).toHaveLength(2);
  });
  it('rung 1 counts live and late branches the way the pin card does', () => {
    const forks = [{ forkId: 'f', drawnAt: '2026-10-10', branches: [{ branchId: 'a', text: 'A', due: '2026-12-01' }, { branchId: 'b', text: 'B', due: '2026-10-01' }] }];
    show({ ...storyC, forks }, '2026-11-03');
    expect(screen.getByText('3 chapters · 5 events · 1 live branch · 1 late')).toBeInTheDocument();
  });
  it('a story whose record could not be read draws nothing', () => {
    const { container } = render(<StoryTree error />);
    expect(container.textContent).toBe('');
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

describe('the drawn tree for a dense story', () => {
  it('keeps its own size (it scrolls in its box, never shrinks) and opens at the right end, on the newest event and the present line', async () => {
    const { default: StoryTreeDrawing } = await import('../components/StoryTreeDrawing.jsx');
    const shown = Array.from({ length: 20 }, (_, i) => ({ eventId: `e${i}`, date: `2026-10-${String(i + 1).padStart(2, '0')}`, title: `Event number ${i}` }));
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(4000);
    const { container } = render(<StoryTreeDrawing shown={shown} branches={[]} present="2026-10-21" />);
    const svg = container.querySelector('svg');
    expect(Number(svg.getAttribute('width'))).toBeGreaterThanOrEqual(20 * 100); // about 20 steps wide, not the column's width
    expect(container.querySelector('.story-tree__scroll').scrollLeft).toBe(4000);
    expect(svg.querySelectorAll('.st-node')).toHaveLength(20);
    expect(svg.querySelector('.st-present')).not.toBeNull();
    spy.mockRestore();
  });
});
