// /today with a real, non-empty archive (tests/fixtures/archive.json): the left-rail archive sidebar
// (grouping, category chips, search, count), which entries are hidden because they are still live
// topics, and the saved-analysis modal a row opens (tabs per available analysis, sources, close).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import archiveFixture from '@fixtures/archive.json';

vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));
vi.mock('@/features/track-record/hooks/useTrackRecord', () => ({ useTrackRecord: () => ({ data: null }) }));
vi.mock('@/features/track-record/hooks/useCorrectionsFeed', () => ({ useCorrectionsFeed: () => ({ notes: [], total: 0 }) }));
vi.mock('@/shared/ui/SubscribeCard', () => ({ default: () => null }));
vi.mock('@/features/breaking/components/BreakingStrip', () => ({ default: () => null }));

let topicsState;
let archiveEntries;
vi.mock('@/shared/data/useGeminiTopics', () => ({ useGeminiTopics: () => topicsState }));
vi.mock('@/features/home/hooks/useTodayArchive', () => ({ useTodayArchive: () => ({ entries: archiveEntries }) }));

import Home from '@/features/home/Home';
import TodayArchiveSidebar from '@/features/home/components/TodayArchiveSidebar';

// The newest day of the fixture (12 real entries: politics 1, conflict 4, energy 1, ...).
const DAY = archiveFixture.data['2026-04-26'];
const ENTRIES = DAY.entries;
const byCategory = (c) => ENTRIES.filter((e) => e.category === c);
const baseTopics = {
  loading: false, error: null, refetch: vi.fn(), isStale: false, updatedAt: null, hasNewData: false,
};
const mount = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  archiveEntries = ENTRIES;
  topicsState = { ...baseTopics, topics: [] };
});

describe('TodayArchiveSidebar', () => {
  it('lists every archived title under its category group, with the total as the count', () => {
    mount(<TodayArchiveSidebar entries={ENTRIES} />);
    expect(screen.getByText("Today's Archive")).toBeInTheDocument();
    for (const e of ENTRIES) expect(screen.getByText(e.title)).toBeInTheDocument();
    // one group header per category present
    const groups = new Set(ENTRIES.map((e) => e.category));
    for (const g of groups) expect(screen.getByRole('heading', { level: 3, name: g })).toBeInTheDocument();
    // known categories follow the fixed order (conflict, politics, military, disaster, technology); the rest go last
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    const order = ['conflict', 'politics', 'military', 'disaster', 'technology'].map((c) => headings.indexOf(c));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order[0]).toBe(0);
    for (const other of ['energy', 'business', 'society', 'climate']) {
      expect(headings.indexOf(other)).toBeGreaterThan(order[4]);
    }
  });

  it('renders nothing for an empty or missing archive', () => {
    const a = mount(<TodayArchiveSidebar entries={[]} />);
    expect(a.container.firstChild).toBeNull();
    a.unmount();
    const b = mount(<TodayArchiveSidebar />);
    expect(b.container.firstChild).toBeNull();
  });

  it('category chips are offered only for the fixed categories present; clicking one filters, clicking again clears', () => {
    mount(<TodayArchiveSidebar entries={ENTRIES} />);
    // energy / business / society / climate are not in the chip list
    expect(screen.queryByRole('button', { name: 'energy' })).toBeNull();
    const chip = screen.getByRole('button', { name: 'conflict' });
    fireEvent.click(chip);
    for (const e of byCategory('conflict')) expect(screen.getByText(e.title)).toBeInTheDocument();
    for (const e of ENTRIES.filter((x) => x.category !== 'conflict')) expect(screen.queryByText(e.title)).toBeNull();
    // group headers drop out while one category is selected
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'conflict' }));
    for (const e of ENTRIES) expect(screen.getByText(e.title)).toBeInTheDocument();
  });

  it('search matches titles case-insensitively and shows "No matching topics" when nothing does', () => {
    mount(<TodayArchiveSidebar entries={ENTRIES} />);
    const box = screen.getByRole('textbox', { name: 'Search archived topics' });
    fireEvent.change(box, { target: { value: 'deepseek' } });
    expect(screen.getByText(/DeepSeek releases V4/)).toBeInTheDocument();
    expect(screen.queryByText(/Hong Kong IPO/)).toBeNull();
    fireEvent.change(box, { target: { value: 'zzzz-no-such-story' } });
    expect(screen.getByText('No matching topics')).toBeInTheDocument();
  });

  it('an entry without a category is grouped as "other"', () => {
    mount(<TodayArchiveSidebar entries={[{ topicId: 'x', title: 'Uncategorised thing' }]} />);
    expect(screen.getByRole('heading', { level: 3, name: 'other' })).toBeInTheDocument();
    expect(screen.getByText('Uncategorised thing')).toBeInTheDocument();
  });
});

describe('ArchiveTopicModal via the sidebar', () => {
  const withAi = {
    ...ENTRIES[1], // "Trump cancels US envoys ..." with regions United States / Iran / Pakistan, no threadId
    ai: { summary: '- First takeaway\n- Second takeaway', prediction: JSON.stringify({ scenarios: [{ label: 'Stalemate', probability_range: '40-55%', rationale: 'Talks stall for weeks.' }] }) },
  };

  it('a row opens a dialog titled with the story, region links, one tab per analysis that exists and sources', () => {
    mount(<TodayArchiveSidebar entries={[withAi]} />);
    fireEvent.click(screen.getByText(withAi.title));
    const dialog = screen.getByRole('dialog', { name: withAi.title });

    expect(within(dialog).getByRole('link', { name: 'Iran' })).toHaveAttribute('href', '/weekly/country/Iran');
    expect(within(dialog).getByRole('link', { name: 'Pakistan' })).toHaveAttribute('href', '/weekly/country/Pakistan');

    // Summary and Prediction exist; Trace Cause does not
    expect(within(dialog).getByRole('tab', { name: 'Summary' })).toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: 'Prediction' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('tab', { name: 'Trace Cause' })).toBeNull();
    expect(within(dialog).getByText('First takeaway')).toBeInTheDocument();
    expect(within(dialog).getByText('Second takeaway')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('tab', { name: 'Prediction' }));
    expect(within(dialog).getByText('Talks stall for weeks.')).toBeInTheDocument();
    expect(within(dialog).queryByText('First takeaway')).toBeNull();

    // every source is an outbound link to its url
    const sourceLinks = within(dialog).getAllByRole('link', { name: (n) => n.length > 0 }).filter((a) => a.classList.contains('archive-source-link'));
    expect(sourceLinks).toHaveLength(withAi.sources.length);
    expect(sourceLinks[0]).toHaveAttribute('href', withAi.sources[0].url);
    expect(sourceLinks[0]).toHaveAttribute('target', '_blank');
    expect(sourceLinks[0]).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('an entry with a threadId links its title to the story page', () => {
    const entry = { ...ENTRIES[0], threadId: 'thread-white-house-dinner-1', ai: { summary: 'Short.' } };
    mount(<TodayArchiveSidebar entries={[entry]} />);
    fireEvent.click(screen.getByText(entry.title));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: entry.title })).toHaveAttribute('href', expect.stringContaining('/weekly/thread/thread-white-house-dinner-1'));
  });

  it('an entry with no saved analysis says so honestly and has no tabs', () => {
    mount(<TodayArchiveSidebar entries={[ENTRIES[0]]} />);
    fireEvent.click(screen.getByText(ENTRIES[0].title));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('No AI analysis available for this topic yet.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('tab')).toBeNull();
  });

  it('closes with the close button, Escape, and a click on the backdrop (not on the dialog)', () => {
    mount(<TodayArchiveSidebar entries={[withAi]} />);
    const open = () => fireEvent.click(screen.getByText(withAi.title));

    open();
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' })[0]);
    expect(screen.queryByRole('dialog')).toBeNull();

    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    open();
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.archive-modal-overlay'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ArchiveTopicModal focus management', () => {
  const entry = {
    ...ENTRIES[1],
    ai: { summary: '- First takeaway', prediction: JSON.stringify({ scenarios: [{ label: 'Stalemate', probability_range: '40-55%', rationale: 'Talks stall.' }] }) },
  };
  const openFromKeyboard = () => {
    mount(<TodayArchiveSidebar entries={[entry]} />);
    const opener = screen.getByRole('button', { name: new RegExp(entry.title.slice(0, 20)) });
    opener.focus();
    fireEvent.click(opener);
    return opener;
  };

  it('moves focus into the dialog (the Close button) when it opens', () => {
    openFromKeyboard();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toContainElement(document.activeElement);
    expect(document.activeElement).toBe(within(dialog).getAllByRole('button', { name: 'Close' })[0]);
  });

  it('keeps Tab and Shift+Tab inside the dialog (wraps last to first and first to last)', () => {
    openFromKeyboard();
    const dialog = screen.getByRole('dialog');
    const tabbable = Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    expect(tabbable.length).toBeGreaterThan(2);

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    // focus that slipped out (e.g. a click on the backdrop) is pulled back in
    document.body.focus();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(dialog).toContainElement(document.activeElement);
  });

  it('restores focus to the row that opened it on Escape and on Close', () => {
    const opener = openFromKeyboard();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();

    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' })[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});

describe('Home with an archive', () => {
  const liveTopic = { topicId: ENTRIES[0].topicId, title: ENTRIES[0].title, category: 'politics', sources: [] };
  const otherTopic = { topicId: 'live-2', title: 'A story only in today list', category: 'economy', sources: [] };

  it('shows the archive rail beside the topics and counts it in the status strip', () => {
    topicsState = { ...baseTopics, topics: [otherTopic] };
    mount(<Home />);
    expect(screen.getByText("Today's Archive")).toBeInTheDocument();
    expect(screen.getByText(ENTRIES[3].title)).toBeInTheDocument();
    const strip = document.querySelector('.ss-strip');
    expect(strip).toHaveTextContent(/1\s*topics/);
    expect(strip).toHaveTextContent(new RegExp(`${ENTRIES.length}\\s*archive`));
  });

  it('hides an archived entry that is still one of today\'s live topics, but still counts it in the strip', () => {
    topicsState = { ...baseTopics, topics: [liveTopic, otherTopic] };
    mount(<Home />);
    const rail = document.querySelector('.archive-rail');
    expect(within(rail).queryByText(liveTopic.title)).toBeNull();
    expect(within(rail).getByText(ENTRIES[1].title)).toBeInTheDocument();
    expect(rail.querySelector('.gp-sec__count')).toHaveTextContent(String(ENTRIES.length - 1));
    expect(document.querySelector('.ss-strip')).toHaveTextContent(new RegExp(`${ENTRIES.length}\\s*archive`));
    // the live topic is still on the page body
    expect(document.getElementById(`topic-${liveTopic.topicId}`)).not.toBeNull();
  });

  it('clicking an archive row on /today opens its saved analysis', () => {
    archiveEntries = [{ ...ENTRIES[3], ai: { trace_cause: JSON.stringify({ proximate: { what: 'Rebel offensive began in March.' } }) } }];
    topicsState = { ...baseTopics, topics: [otherTopic] };
    mount(<Home />);
    fireEvent.click(within(document.querySelector('.archive-rail')).getByText(ENTRIES[3].title));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('tab', { name: 'Trace Cause' })).toBeInTheDocument();
    expect(within(dialog).getByText('Rebel offensive began in March.')).toBeInTheDocument();
  });

  it('with an empty archive there is no archive rail and no archive stat', () => {
    archiveEntries = [];
    topicsState = { ...baseTopics, topics: [otherTopic] };
    mount(<Home />);
    expect(document.querySelector('.archive-rail')).toBeNull();
    expect(document.querySelector('.ss-strip')).not.toHaveTextContent(/archive/);
  });

  it('with every archived entry also live, the rail shows nothing rather than an empty box', () => {
    archiveEntries = [ENTRIES[0]];
    topicsState = { ...baseTopics, topics: [liveTopic] };
    mount(<Home />);
    expect(document.querySelector('.archive-rail')).toBeNull();
  });
});
