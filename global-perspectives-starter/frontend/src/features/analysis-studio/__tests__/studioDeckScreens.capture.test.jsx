// S5c screenshot capture harness — writes HTML for the Studio deck (F1 base, F2 stacking,
// F3 board toggle) with a mocked provider, same approach as analysisStudioScreens.capture.test.jsx
// (S5a): renders the real AnalysisStudio component tree with test-only injections of its
// auth/network/llm dependencies. Only `npm run verify` (vitest) gates this file; the
// screenshot pass is a separate Playwright script against the written HTML.
/* global process */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';

// These render the whole Studio page and wait on mocked async fetches + a mocked run; under a
// parallel suite the 1 s default for findBy*/waitFor raced intermittently.
configure({ asyncUtilTimeout: 5000 });
import { MemoryRouter } from 'react-router-dom';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const AS_CSS = readFileSync(resolve(HERE, '../AnalysisStudio.css'), 'utf8');
const SP_CSS = readFileSync(resolve(HERE, '../components/StudioPictures.css'), 'utf8');
const SD_CSS = readFileSync(resolve(HERE, '../components/StudioDeck.css'), 'utf8');
const AV_CSS = readFileSync(resolve(HERE, '../components/AnalysisVisuals.css'), 'utf8');
const TOKENS_CSS = readFileSync(resolve(HERE, '../../../shared/styles/tokens.css'), 'utf8');
// The dark deck reuses StoryMode/PhoneStoryMode's .sm-*/.psm-* shell classes (StudioDeck.jsx
// imports these same two files) — the snapshot must carry their CSS too, or the deck renders
// unstyled (no dark surface, default browser buttons) even though the real app (which loads
// every imported .css through Vite) looks correct.
const SM_CSS = readFileSync(resolve(HERE, '../../threads/components/StoryMode.css'), 'utf8');
const PSM_CSS = readFileSync(resolve(HERE, '../../threads/components/PhoneStoryMode.css'), 'utf8');

const OUT_DIR = process.env.GP_CAPTURE_DIR || null;

const MOCK_USER = { uid: 'test-user', isAnonymous: false };
vi.mock('@/shared/contexts/AuthContext', () => ({
  useAuth: () => ({ user: MOCK_USER, loading: false }),
}));
vi.mock('@/features/account/hooks/useMembership', () => ({
  useMembership: () => ({ isMember: false, creditBalance: 0, available: false, refresh: vi.fn() }),
}));
vi.mock('@/shared/data/useGeminiTopics', () => ({
  useGeminiTopics: () => ({
    topics: [
      { topicId: 'topic-afd-4', threadId: 'thread-germany-s-far-right-afd-poised-054baa', title: 'Naval standoff escalates in the Taiwan Strait', category: 'Conflict', regions: ['Taiwan', 'East Asia'] },
      { topicId: 'story-2', threadId: 'thread-trade-talks', title: 'Back-channel trade talks reopen', category: 'Politics', regions: ['East Asia'] },
    ],
    loading: false,
  }),
}));
vi.mock('@/shared/api/restProxy', () => ({
  analyzeConfigured: () => false,
  runMemberAnalysis: vi.fn(),
  fetchSummaryCache: vi.fn(async () => ({ text: 'Two navies traded warnings after a near-collision in the strait.' })),
  fetchPredictionCache: vi.fn(async () => ({ text: 'A tense standoff most likely persists near-term.' })),
  fetchTraceCauseCache: vi.fn(async () => ({ text: 'Long-running sovereignty dispute over the strait.' })),
  fetchNarrativeThread: vi.fn(async (threadId) => ({
    data: [{ threadId, archivedAt: '2026-09-13T00:00:00.000Z', topicId: 'topic-afd-4', sources: [
      { title: 'Navies expand patrols near Taiwan', source: 'wire.com', snippet: 'Both sides expanded patrols.', url: 'https://example.com/patrols' },
    ] }],
  })),
  fetchThreadAnalyses: vi.fn(async (threadIds) => {
    const data = {};
    if (threadIds.includes('thread-germany-s-far-right-afd-poised-054baa')) {
      data['thread-germany-s-far-right-afd-poised-054baa'] = {
        trajectory: 'The standoff near Taiwan is likely to persist without a further trigger.',
        generatedAt: '2026-09-22T06:31:46.856Z',
        driftNote: { asOf: '2026-09-20', changeLevel: { from: 'elevated', to: 'high' }, triggerEvent: { title: 'A patrol incident', date: '2026-09-19' }, whyChanged: 'Patrol density near Taiwan increased sharply.' },
        entryShortTitles: [],
      };
    }
    return { data };
  }),
  fetchArchiveRange: vi.fn(async () => ({ data: {} })),
  fetchPredictionSnapshot: vi.fn(async (topicIds) => {
    if (topicIds.includes('topic-afd-4')) {
      return { snapshot: { generatedAt: '2026-09-13T00:05:52.435Z', scenarios: [
        { label: 'Standoff persists', probability: 0.6, triggers: [{ text: 'No incident near Taiwan by October 31', deadline: '2026-10-31' }] },
      ] } };
    }
    return { snapshot: null };
  }),
  // What changed's real `country_history` fetch (monitor round 2) — Taiwan is a real
  // country name so iso3ForName resolves it as a backed place. The drift note wording
  // mirrors the real Iran 2026-08-19 shape (a self-contradictory "score down"/"worsen"
  // clause) so the direction-check flag actually surfaces in the screenshot.
  fetchCountryHistory: vi.fn(async (countryName) => {
    if (countryName === 'Taiwan') {
      return {
        success: true,
        countryName: 'Taiwan',
        snapshots: [
          { dateKey: '2026-08-01', riskScore: 55 },
          { dateKey: '2026-09-01', riskScore: 60 },
          { dateKey: '2026-09-20', riskScore: 62 },
        ],
        driftNotes: [
          {
            asOf: '2026-09-19',
            whyChanged: 'The patrol incident shifts the conflict score down as tensions worsen near the strait.',
            triggerEvent: { title: 'A patrol incident', date: '2026-09-19' },
            changeScore: { from: 60, to: 62, delta: 2 },
          },
        ],
        driftNotesTotal: 1,
        driftNotesGated: false,
      };
    }
    return { success: true, countryName, snapshots: [], driftNotes: [], driftNotesTotal: 0, driftNotesGated: false };
  }),
}));

let mockRunChatImpl = null;
vi.mock('@/features/analysis-studio/lib/llm', async () => {
  const actual = await vi.importActual('@/features/analysis-studio/lib/llm');
  return { ...actual, runChat: (...args) => mockRunChatImpl(...args) };
});

import AnalysisStudio from '@/features/analysis-studio/AnalysisStudio.jsx';
import { saveByok } from '@/features/analysis-studio/lib/byok';

function writeSnapshot(name, container) {
  if (!OUT_DIR) return;
  try { mkdirSync(OUT_DIR, { recursive: true }); } catch { /* exists */ }
  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>${TOKENS_CSS}</style>
<style>${AS_CSS}</style>
<style>${AV_CSS}</style>
<style>${SP_CSS}</style>
<style>${SD_CSS}</style>
<style>${SM_CSS}</style>
<style>${PSM_CSS}</style>
<style>body{background:var(--paper,#fbfbf9);margin:0;}</style>
</head><body>${container.innerHTML}</body></html>`;
  writeFileSync(`${OUT_DIR}/${name}.snapshot.html`, html, 'utf8');
}

function setWidth(px) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });
  window.dispatchEvent(new Event('resize'));
}

const SCENARIO_TEXT =
  '## Bottom line\nA standoff near Taiwan analyzed in [1] is likely to persist without a further trigger.\n\n' +
  '## Scenarios\n- Standoff persists (55-65%): patrols continue near Taiwan, no shots [1].\n' +
  '- Escalation (20-30%): a clash near Taiwan by October 31 breaks the calm [3].\n\n' +
  '```gp-struct\n{"scenarios":[{"name":"Standoff persists","pLow":55,"pHigh":65},{"name":"Escalation","pLow":20,"pHigh":30,"by":"2026-10-31","places":["Taiwan"]}]}\n```';

const COMPARE_TEXT =
  '## Bottom line\nBoth stories touch East Asia [1][2].\n\n## Compare\nThe standoff [1] and the trade talks [2] share a region, though the read on each differs.';

const WHATCHANGED_TEXT =
  '## Bottom line\nWhat changed since the last note [2] is a sharper patrol posture near Taiwan [1].\n\n' +
  '## Change log\n- 2026-09-19: a patrol incident raised the temperature [2].';

const FREEFORM_TEXT =
  '## Bottom line\nThe standoff is likely to persist near-term [1]. Fresh coverage confirms expanded patrols [3].';

async function selectBothStories() {
  fireEvent.click(await screen.findByText('Naval standoff escalates in the Taiwan Strait'));
  fireEvent.click(await screen.findByText('Back-channel trade talks reopen'));
}

async function runLens(lensLabelRe) {
  fireEvent.click(screen.getByRole('button', { name: /guided lens/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: lensLabelRe })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: lensLabelRe }));
  fireEvent.click(screen.getByRole('button', { name: /run analysis|add analysis/i }));
}

// The deck opens on the "Bottom line" slide — the slide-nav dots carry the full slide name
// as their `title` (and aria-label), so this reaches the PICTURE slide for whichever lens
// just ran without depending on the dot's short visible code.
// The deck settles its focused section in an effect right after the first render (resetting the
// slide to 0), so a click that lands before that is undone; retry until the dot is the selected one.
async function gotoSlide(titleText) {
  await waitFor(() => {
    const dot = screen.getByTitle(titleText);
    if (dot.getAttribute('aria-selected') !== 'true') fireEvent.click(dot);
    expect(screen.getByTitle(titleText).getAttribute('aria-selected')).toBe('true');
  });
}


// Same settle race for the section switcher: the deck focuses the newest section in an effect,
// which can land after a click on an older section's tab. Retry until that tab is selected.
// Scoped to the switcher chips: a slide dot can carry the same name (the lens picture slide).
function sectionChip(name) {
  return [...document.querySelectorAll('.sd-switcher-chip')].find((el) => el.textContent.trim() === name);
}
async function selectSection(name) {
  await waitFor(() => {
    const chip = sectionChip(name);
    expect(chip).toBeTruthy();
    if (chip.getAttribute('aria-selected') !== 'true') fireEvent.click(chip);
    expect(sectionChip(name).getAttribute('aria-selected')).toBe('true');
  });
}

describe('Studio deck — S5c mocked-provider screen capture', () => {
  beforeEach(() => {
    localStorage.clear();
    setWidth(1440);
    saveByok({ provider: 'openai', model: 'gpt-5.6', key: 'sk-test-fake' });
  });
  afterEach(() => setWidth(1024));

  it('Scenario lens deck — map + slide card + time bar, bands picture', async () => {
    mockRunChatImpl = async () => ({ text: SCENARIO_TEXT, webSources: [], usage: { inputTokens: 800, outputTokens: 200, model: 'gpt-5.6' } });
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    fireEvent.click(await screen.findByText('Naval standoff escalates in the Taiwan Strait'));
    await runLens(/^scenario forecast/i);
    await screen.findByTitle('Scenario forecast', {}, { timeout: 5000 }); // the deck has rendered
    expect(container.querySelector('.sm-mapwrap')).toBeTruthy(); // the map
    expect(container.querySelector('.sp-timebar')).toBeTruthy(); // the time bar
    await gotoSlide('Scenario forecast'); // the PICTURE slide
    await waitFor(() => expect(screen.getByText(/Scenario timeline/i)).toBeInTheDocument());
    writeSnapshot('s5c2_deck_scenario', container);
  });

  it('Compare lens deck — lanes + shared-region picture', async () => {
    mockRunChatImpl = async () => ({ text: COMPARE_TEXT, webSources: [], usage: { inputTokens: 700, outputTokens: 150, model: 'gpt-5.6' } });
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    await selectBothStories();
    await runLens(/^compare stories/i);
    await screen.findByTitle('Compare stories', {}, { timeout: 5000 });
    await gotoSlide('Compare stories');
    await waitFor(() => expect(screen.getByText(/Compare — lanes/i)).toBeInTheDocument());
    writeSnapshot('s5c2_deck_compare', container);
  });

  it('What changed lens deck — real country_history risk chart + change log + direction flag', async () => {
    mockRunChatImpl = async () => ({ text: WHATCHANGED_TEXT, webSources: [], usage: { inputTokens: 700, outputTokens: 150, model: 'gpt-5.6' } });
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    fireEvent.click(await screen.findByText('Naval standoff escalates in the Taiwan Strait'));
    await runLens(/^what changed/i);
    await screen.findByTitle('What changed', {}, { timeout: 5000 });
    await gotoSlide('What changed');
    await waitFor(() => expect(screen.getByText(/risk trend/i)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText('Taiwan')).toBeInTheDocument();
    // The real Taiwan-shaped drift note ("score down" + "worsen") trips the direction flag.
    expect(screen.getByText(/wording\/direction mismatch/i)).toBeInTheDocument();
    writeSnapshot('s5c2_deck_whatchanged', container);
  });

  it('Free-form lens deck — click-a-sentence picture', async () => {
    mockRunChatImpl = async () => ({ text: FREEFORM_TEXT, webSources: [], usage: { inputTokens: 500, outputTokens: 120, model: 'gpt-5.6' } });
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    fireEvent.click(await screen.findByText('Naval standoff escalates in the Taiwan Strait'));
    fireEvent.click(screen.getByRole('button', { name: /^free-form/i }));
    fireEvent.click(screen.getByRole('button', { name: /run analysis|add analysis/i }));
    await screen.findByTitle('Free-form', {}, { timeout: 5000 });
    await gotoSlide('Free-form');
    await waitFor(() => expect(screen.getByText(/Click a sentence/i)).toBeInTheDocument());
    writeSnapshot('s5c2_deck_freeform', container);
  });

  it('F2 — a stacked case (2 lenses on the same frozen selection), switcher + BOARD', async () => {
    mockRunChatImpl = async () => ({ text: SCENARIO_TEXT, webSources: [], usage: { inputTokens: 800, outputTokens: 200, model: 'gpt-5.6' } });
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    fireEvent.click(await screen.findByText('Naval standoff escalates in the Taiwan Strait'));
    await runLens(/^scenario forecast/i);
    await screen.findByTitle('Scenario forecast', {}, { timeout: 5000 });

    mockRunChatImpl = async () => ({ text: WHATCHANGED_TEXT, webSources: [], usage: { inputTokens: 700, outputTokens: 150, model: 'gpt-5.6' } });
    await runLens(/^what changed/i);
    // The switcher now offers both sections; the newest (What changed) is focused.
    await waitFor(() => expect(container.querySelectorAll('.sd-switcher-chip').length).toBe(2));
    writeSnapshot('s5c2_deck_stacked_case', container);

    // Switching sections swaps the whole deck (map + slides + time bar) to that run.
    await selectSection('Scenario forecast');
    await gotoSlide('Scenario forecast');
    await waitFor(() => expect(screen.getByText(/Scenario timeline/i)).toBeInTheDocument());

    // F3 — DECK | READ AS TEXT | BOARD toggle
    fireEvent.click(screen.getByRole('button', { name: 'BOARD' }));
    await waitFor(() => expect(container.querySelector('.as-board-grid')).toBeTruthy());
    expect(screen.getAllByText(/Receipt/).length).toBeGreaterThan(0);
    writeSnapshot('s5c2_deck_board', container);
  });

  it('a failed-check run inside a case is isolated to its own deck section', async () => {
    mockRunChatImpl = async () => ({ text: SCENARIO_TEXT, webSources: [], usage: { inputTokens: 800, outputTokens: 200, model: 'gpt-5.6' } });
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    fireEvent.click(await screen.findByText('Naval standoff escalates in the Taiwan Strait'));
    await runLens(/^scenario forecast/i);
    await screen.findByTitle('Scenario forecast', {}, { timeout: 5000 });

    mockRunChatImpl = async () => ({ text: '## Bottom line\nEscalation is likely [1], and a phantom fifth source [5] confirms it.', webSources: [] });
    await runLens(/^what changed/i);
    // The newly-focused (failing) section's Bottom line slide opens on the checks-failed note.
    await waitFor(() => expect(screen.getByText(/failed a guardrail check and is not shareable/i)).toBeInTheDocument());
    writeSnapshot('s5c2_deck_failed_in_case', container);

    // Switching back to the FIRST (passing) section proves the failure never touched it.
    await selectSection('Scenario forecast');
    await gotoSlide('Scenario forecast');
    await waitFor(() => expect(screen.getByText(/Scenario timeline/i)).toBeInTheDocument());
  });

  it('P1 — phone tabs (READ / MAP / LOG) on the dark surface, BOARD hidden', async () => {
    setWidth(390);
    mockRunChatImpl = async () => ({ text: SCENARIO_TEXT, webSources: [], usage: { inputTokens: 800, outputTokens: 200, model: 'gpt-5.6' } });
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    fireEvent.click(await screen.findByText('Naval standoff escalates in the Taiwan Strait'));
    await runLens(/^scenario forecast/i);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'MAP' })).toBeInTheDocument());
    expect(container.querySelector('.as-view-toggle')).toBeFalsy();
    expect(container.querySelector('.gp-console.psm-root')).toBeTruthy();
    writeSnapshot('s5c2_phone_read', container);

    fireEvent.click(screen.getByRole('tab', { name: 'MAP' }));
    await waitFor(() => expect(container.querySelector('.sm-mapwrap')).toBeTruthy());
    writeSnapshot('s5c2_phone_map', container);

    fireEvent.click(screen.getByRole('tab', { name: 'LOG' }));
    await waitFor(() => expect(container.querySelector('.as-phone-log-row')).toBeTruthy());
    expect(container.querySelector('.as-phone-log-lens').textContent).toBe('Scenario forecast');
    writeSnapshot('s5c2_phone_log', container);
  });
});
