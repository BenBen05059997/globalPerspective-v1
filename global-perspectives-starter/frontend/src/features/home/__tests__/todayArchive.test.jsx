// /today with a real, non-empty archive (tests/fixtures/archive.json): the left-rail archive sidebar
// (grouping, category chips, search, count), which entries are hidden because they are still live
// topics, and the saved-analysis modal a row opens (tabs per available analysis, sources, close).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import archiveFixture from '@fixtures/archive.json';

const report = vi.fn();
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: (...a) => report(...a) }));
const getTopicPrediction = vi.fn();
const getTopicTraceCause = vi.fn();
vi.mock('@/shared/data/contentService', () => ({
  default: { getTopicPrediction: (...a) => getTopicPrediction(...a), getTopicTraceCause: (...a) => getTopicTraceCause(...a) },
}));
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
  report.mockReset();
  getTopicPrediction.mockReset();
  getTopicTraceCause.mockReset();
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

  it('every category in the data gets a chip (known ones first, the rest after); clicking one filters, clicking again clears', () => {
    mount(<TodayArchiveSidebar entries={ENTRIES} />);
    const chips = document.querySelectorAll('.archive-rail-chips button');
    const cats = [...new Set(ENTRIES.map((e) => e.category))];
    expect([...chips].map((c) => c.textContent).sort()).toEqual([...cats].sort());
    for (const c of ['energy', 'business', 'society', 'climate']) {
      if (cats.includes(c)) expect(screen.getByRole('button', { name: c })).toBeInTheDocument();
    }
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

  it('society, science and uncategorised entries each get a chip that filters to them', () => {
    const entries = [
      { topicId: 'a', title: 'Politics one', category: 'politics' },
      { topicId: 'b', title: 'Society one', category: 'society' },
      { topicId: 'c', title: 'Science one', category: 'science' },
      { topicId: 'd', title: 'No category one' },
    ];
    mount(<TodayArchiveSidebar entries={entries} />);
    expect([...document.querySelectorAll('.archive-rail-chips button')].map((c) => c.textContent))
      .toEqual(['politics', 'other', 'science', 'society']);
    fireEvent.click(screen.getByRole('button', { name: 'science' }));
    expect(screen.getByText('Science one')).toBeInTheDocument();
    expect(screen.queryByText('Society one')).toBeNull();
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

  // The archive trims forecast / trace text to 1,500 characters + "...", so the stored JSON is cut and does not parse.
  const cut = (obj) => `${JSON.stringify(obj).slice(0, 40)}...`;
  const full = { scenarios: [{ label: 'Full scenario', probability_range: '10-20%', rationale: 'From the full note.' }] };
  const traceFull = { proximate: { what: 'Full trace from the note.' } };
  const cutEntry = { ...ENTRIES[1], ai: { summary: 'Short.', prediction: cut(full), trace_cause: cut(traceFull) } };

  it('a cut Prediction / Trace Cause text is replaced by the full note read by topicId, never "failed"', async () => {
    getTopicPrediction.mockResolvedValue({ content: JSON.stringify(full) });
    getTopicTraceCause.mockResolvedValue({ content: JSON.stringify(traceFull) });
    mount(<TodayArchiveSidebar entries={[cutEntry]} />);
    fireEvent.click(screen.getByText(cutEntry.title));
    const dialog = screen.getByRole('dialog');
    expect(getTopicPrediction).toHaveBeenCalledWith(cutEntry.topicId);
    fireEvent.click(await within(dialog).findByRole('tab', { name: 'Prediction' }));
    expect(await within(dialog).findByText('From the full note.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Trace Cause' }));
    expect(await within(dialog).findByText('Full trace from the note.')).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/generation failed/);
  });

  it('a cut text with no stored note leaves its tab out; a miss is not an error, a failure is reported', async () => {
    getTopicPrediction.mockRejectedValue(new Error('Cache miss'));
    getTopicTraceCause.mockRejectedValue(new Error('Proxy HTTP 503: x'));
    mount(<TodayArchiveSidebar entries={[cutEntry]} />);
    fireEvent.click(screen.getByText(cutEntry.title));
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(within(dialog).queryByRole('tab', { name: 'Prediction' })).toBeNull());
    await waitFor(() => expect(within(dialog).queryByRole('tab', { name: 'Trace Cause' })).toBeNull());
    expect(within(dialog).getByRole('tab', { name: 'Summary' })).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/generation failed/);
    expect(report.mock.calls.map((c) => c[0])).toEqual(['today-archive-trace_cause']);
  });

  it('a text that parses is shown as is, with no lookup', () => {
    mount(<TodayArchiveSidebar entries={[withAi]} />);
    fireEvent.click(screen.getByText(withAi.title));
    expect(getTopicPrediction).not.toHaveBeenCalled();
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

  it('hides an archived entry that is still one of today\'s live topics, and the strip counts the same rows as the rail', () => {
    topicsState = { ...baseTopics, topics: [liveTopic, otherTopic] };
    mount(<Home />);
    const rail = document.querySelector('.archive-rail');
    expect(within(rail).queryByText(liveTopic.title)).toBeNull();
    expect(within(rail).getByText(ENTRIES[1].title)).toBeInTheDocument();
    expect(rail.querySelector('.gp-sec__count')).toHaveTextContent(String(ENTRIES.length - 1));
    // the strip counts what the rail lists
    expect(document.querySelector('.ss-strip')).toHaveTextContent(new RegExp(`${ENTRIES.length - 1}\\s*archive`));
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
