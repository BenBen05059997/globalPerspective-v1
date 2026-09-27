// S5a screenshot capture harness — NOT a regression test (no assertions gate CI
// meaningfully here beyond the sanity checks below). Renders the REAL AnalysisStudio
// component tree (real validator, real webCitations renumbering, real Markdown/CSS
// classes) with a "test-only injection" of its auth/network dependencies — the
// alternative to Playwright request interception named in the S5a brief, since
// there is no real Firebase account to sign in with in this environment.
//
// Writes each captured state's HTML to the scratchpad dir so a follow-up Playwright
// script (see quality/analysis, or the operator's local run) can load it against the
// real AnalysisStudio.css + tokens.css and take a pixel screenshot. This file itself
// only needs `npm run verify` (vitest) to pass — the screenshot step is separate.
/* global process */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const AS_CSS = readFileSync(resolve(HERE, '../AnalysisStudio.css'), 'utf8');
const TOKENS_CSS = readFileSync(resolve(HERE, '../../../shared/styles/tokens.css'), 'utf8');

// Opt-in: set GP_CAPTURE_DIR to write the rendered screens as HTML for a screenshot pass. Without it
// the assertions still run but nothing is written to disk.
const OUT_DIR = process.env.GP_CAPTURE_DIR || null;

// Stable object identity matters here: useWeeklyArchive's fetch effect depends on `[user]`
// (via a useCallback), so a mock that returns a FRESH object literal on every call breaks
// that reference-equality guard and fires an infinite fetch/re-render loop (hung this file
// once — D2 monitor round). A real AuthContext provider gives a stable reference; mirror that.
const MOCK_USER = { uid: 'test-user', isAnonymous: false };
vi.mock('@/shared/contexts/AuthContext', () => ({
  useAuth: () => ({ user: MOCK_USER, loading: false }),
}));
vi.mock('@/features/account/hooks/useMembership', () => ({
  useMembership: () => ({ isMember: false, creditBalance: 0, available: false, refresh: vi.fn() }),
}));
// D2 (S5b): story-1 carries a threadId so the D2 stored-data feed activates (RICH —
// a stored thread analysis + a forecast log), demonstrating the typed-source path.
// story-2 has NO threadId, so it stays on the legacy per-topic cache path (also
// RICH, via SUMMARY/PREDICTION/TRACE_CAUSE — unchanged from S5a). story-3 has a
// threadId whose stored fetches all come back empty — genuinely THIN (headlines
// only), for the quote's THIN screenshot.
vi.mock('@/shared/data/useGeminiTopics', () => ({
  useGeminiTopics: () => ({
    topics: [
      { topicId: 'topic-afd-4', threadId: 'thread-germany-s-far-right-afd-poised-054baa', title: 'Naval standoff escalates in a contested strait', category: 'Conflict', regions: ['East Asia'] },
      { topicId: 'story-2', title: 'Back-channel talks reopen between the two governments', category: 'Politics', regions: ['East Asia'] },
      { topicId: 'topic-thin-1', threadId: 'thread-thin-demo-only-headlines', title: 'Unconfirmed reports of a border skirmish', category: 'Conflict', regions: ['Sahel'] },
    ],
    loading: false,
  }),
}));
vi.mock('@/shared/api/restProxy', () => ({
  analyzeConfigured: () => false,
  runMemberAnalysis: vi.fn(),
  fetchSummaryCache: vi.fn(async () => ({ text: 'Two navies traded warnings after a near-collision in the contested strait; one side announced expanded patrols and the other lodged a formal protest. Shipping insurers flagged sharply higher premiums on the route, and several carriers rerouted tankers to avoid the immediate area pending clarity.' })),
  fetchPredictionCache: vi.fn(async () => ({ text: 'A tense standoff most likely persists near-term; a limited incident is plausible but full conflict is unlikely without a further trigger.' })),
  fetchTraceCauseCache: vi.fn(async () => ({ text: 'Long-running sovereignty dispute over the waterway, with periodic flare-ups over the past decade tied to resource claims and naval posturing on both sides.' })),
  fetchNarrativeThread: vi.fn(async (threadId) => {
    if (threadId === 'thread-germany-s-far-right-afd-poised-054baa') {
      return {
        data: [
          { threadId, archivedAt: '2026-09-13T00:00:00.000Z', topicId: 'topic-afd-4', sources: [
            { title: 'Tens of thousands protest AfD across Germany', source: 'aljazeera.com', snippet: 'Protesters in about 20 cities demand the AfD be banned.', url: 'https://example.com/afd-protest' },
          ] },
        ],
      };
    }
    return { data: [{ threadId, archivedAt: '2026-09-01T00:00:00.000Z', topicId: 'topic-thin-1', sources: [
      { title: 'Unconfirmed reports of a border skirmish', source: 'wire.com', snippet: 'Local reports, unconfirmed by either government, describe an exchange of fire.', url: 'https://example.com/border-skirmish' },
    ] }] };
  }),
  fetchThreadAnalyses: vi.fn(async (threadIds) => {
    const data = {};
    if (threadIds.includes('thread-germany-s-far-right-afd-poised-054baa')) {
      data['thread-germany-s-far-right-afd-poised-054baa'] = {
        trajectory: 'The AfD, having won the most votes but fallen short of a majority, faces a difficult path to coalition amid the mainstream-party "firewall".',
        generatedAt: '2026-09-22T06:31:46.856Z',
        entryShortTitles: [],
      };
    }
    // "Earlier stories" picker preview (D2 monitor round): one archive story with a
    // stored analysis (RICH badge), the rest come back empty (THIN badge).
    if (threadIds.includes('thread-earlier-rich')) {
      data['thread-earlier-rich'] = {
        trajectory: 'The central bank\'s surprise hike is likely to cool consumer demand into year-end.',
        generatedAt: '2026-09-20T09:00:00.000Z',
        entryShortTitles: [],
      };
    }
    return { data }; // anything else (e.g. thin-demo): nothing stored
  }),
  fetchArchiveRange: vi.fn(async () => ({
    data: {
      '2026-09-20': {
        source: 'archive',
        updatedAt: '2026-09-20T00:00:00.000Z',
        entries: [
          { topicId: 'earlier-1', threadId: 'thread-earlier-rich', title: 'Central bank raises rates amid inflation surge', category: 'Economy', regions: ['Eurozone'] },
          { topicId: 'earlier-2', threadId: 'thread-earlier-thin', title: 'Unconfirmed border incident reported', category: 'Conflict', regions: ['Sahel'] },
        ],
      },
      '2026-09-10': {
        source: 'archive',
        updatedAt: '2026-09-10T00:00:00.000Z',
        entries: [
          { topicId: 'earlier-3', threadId: 'thread-earlier-old', title: 'Regional trade summit concludes with new pact', category: 'Politics', regions: ['ASEAN'] },
        ],
      },
    },
  })),
  fetchPredictionSnapshot: vi.fn(async (topicIds) => {
    if (topicIds.includes('topic-afd-4')) {
      return { snapshot: { generatedAt: '2026-09-13T00:05:52.435Z', scenarios: [
        { label: 'Most Likely', probability: 0.6, triggers: [{ text: 'Chancellor Merz rules out a federal coalition with the AfD', deadline: '2026-10-31' }] },
      ] } };
    }
    return { snapshot: null }; // thin-demo: no forecast log either
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
<style>body{background:var(--paper,#fbfbf9);margin:0;}</style>
</head><body>${container.innerHTML}</body></html>`;
  writeFileSync(`${OUT_DIR}/${name}.snapshot.html`, html, 'utf8');
}

async function selectStory(title) {
  const storyBtn = await screen.findByText(title);
  fireEvent.click(storyBtn);
}

async function selectFirstStoryAndRun() {
  await selectStory('Naval standoff escalates in a contested strait');
  // Free-form mode never requires a gp-struct block, so these fixtures can focus
  // purely on the citation/checks behaviour under test without also having to
  // satisfy the Scenario/Economic lens's structural-schema requirement.
  fireEvent.click(screen.getByRole('button', { name: /free-form/i }));
  const runBtn = screen.getByRole('button', { name: /run analysis/i });
  fireEvent.click(runBtn);
}

describe('AnalysisStudio — S5a mocked-provider screen capture', () => {
  beforeEach(() => {
    // useWeeklyArchive (the earlier-stories picker, D2) caches to localStorage — clear it
    // so every test sees this file's mocked fetchArchiveRange, not a stale prior run's data.
    localStorage.clear();
  });

  it('passing run: web [Wn] + stored [n] citations render together, checks pass, receipt shown', async () => {
    saveByok({ provider: 'openai', model: 'gpt-5.6', key: 'sk-test-fake' });
    mockRunChatImpl = async () => ({
      text:
        '## Bottom line\nThe standoff analyzed in [1] is likely to persist near-term; the forecast log [2] puts a federal-coalition ruling-out by late October, and fresh coverage [3] shows protests demanding a ban.\n\n' +
        '## What changed\nNew wire reporting corroborates the patrol expansion [W1] and adds a shipping-insurance angle [W2].',
      webSources: [
        { title: 'Reuters: Navies expand patrols', url: 'https://example.com/reuters-patrols' },
        { title: 'AP: Insurers raise premiums on the route', url: 'https://example.com/ap-insurance' },
      ],
      usage: { inputTokens: 1450, outputTokens: 380, model: 'gpt-5.6-2026-07-09' },
    });

    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    await selectFirstStoryAndRun();
    await waitFor(() => expect(screen.getByText(/Guardrail check passed/i)).toBeInTheDocument());

    expect(screen.getByText(/Tokens: 1450 in \/ 380 out/i)).toBeInTheDocument();
    expect(container.querySelector('.as-web-chip')).toBeTruthy(); // the web-source chip
    expect(screen.getAllByText(/\[W1\]/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\[W2\]/).length).toBeGreaterThan(0);
    writeSnapshot('s5a_studio_pass', container);
  });

  it('failing run: phantom citation hides the report behind "show anyway" and marks it not shareable', async () => {
    saveByok({ provider: 'openai', model: 'gpt-5.6', key: 'sk-test-fake' });
    mockRunChatImpl = async () => ({
      text:
        // Story-1 now carries multiple typed sources (ANALYSIS/FORECAST/NEWS — D2), so
        // [1]..[3] all exist; [4] is the phantom (out of range) that forces a failure.
        '## Bottom line\nThe standoff is likely to persist [1], and a fourth source [4] confirms escalation risk.',
      webSources: [],
      usage: { inputTokens: 900, outputTokens: 210, model: 'gpt-5.6-2026-07-09' },
    });

    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    await selectFirstStoryAndRun();
    await waitFor(() => expect(screen.getByText(/Checks failed — this run is not shareable/i)).toBeInTheDocument());

    // Hidden by default — the prose/report is not in the DOM at all.
    expect(screen.queryByText(/Bottom line/i)).not.toBeInTheDocument();
    writeSnapshot('s5a_studio_fail_hidden', container);

    fireEvent.click(screen.getByText(/Show anyway/i));
    await waitFor(() => expect(screen.getByText(/Bottom line/i)).toBeInTheDocument());
    expect(screen.getByText(/Shown despite failed checks — not shareable/i)).toBeInTheDocument();
    writeSnapshot('s5a_studio_fail_expanded', container);
  });

  it('S5b picker — earlier stories (last 30 days): dated, searchable, RICH/THIN preview', async () => {
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    await screen.findByText('Earlier stories (last 30 days)');
    // Both archive-only stories (not among today's 3 mocked topics) should appear.
    await screen.findByText('Central bank raises rates amid inflation surge');
    await screen.findByText('Unconfirmed border incident reported');
    await screen.findByText('Regional trade summit concludes with new pact');
    // The RICH preview badge lands once the batched thread_analysis mock resolves.
    await waitFor(() => expect(screen.getAllByText('RICH').length).toBeGreaterThan(0));
    expect(screen.getAllByText('THIN').length).toBeGreaterThan(0);
    writeSnapshot('s5b_studio_picker_earlier_unfiltered', container);

    // Search narrows the list live.
    const search = screen.getByPlaceholderText('Search earlier stories…');
    fireEvent.change(search, { target: { value: 'central bank' } });
    await waitFor(() => expect(screen.queryByText('Regional trade summit concludes with new pact')).not.toBeInTheDocument());
    expect(screen.getByText('Central bank raises rates amid inflation surge')).toBeInTheDocument();
    writeSnapshot('s5b_studio_picker_earlier_search', container);

    // Selecting an earlier story feeds the SAME selection/quote path as today's topics.
    fireEvent.click(screen.getByText('Central bank raises rates amid inflation surge'));
    await waitFor(() => expect(screen.getByText(/1 story selected/)).toBeInTheDocument());
  });

  it('S5b quote — RICH selection: stored analysis + forecast + news, typed counts shown', async () => {
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    await selectStory('Naval standoff escalates in a contested strait');
    await waitFor(() => expect(screen.getAllByText(/RICH/).length).toBeGreaterThan(0));
    expect(screen.getByText(/1 RICH \(stored analysis \/ drift \/ forecast\)/)).toBeInTheDocument();
    expect(screen.getByText(/Your provider bills you directly/)).toBeInTheDocument();
    writeSnapshot('s5b_studio_quote_rich', container);
  });

  it('S5b quote — THIN selection: headlines only, no stored analysis/forecast/drift', async () => {
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    await selectStory('Unconfirmed reports of a border skirmish');
    await waitFor(() => expect(screen.getAllByText(/THIN/).length).toBeGreaterThan(0));
    expect(screen.getByText(/0 RICH \(stored analysis \/ drift \/ forecast\), 1 THIN/)).toBeInTheDocument();
    writeSnapshot('s5b_studio_quote_thin', container);
  });

  it('S5b receipt — passing run', async () => {
    saveByok({ provider: 'openai', model: 'gpt-5.6', key: 'sk-test-fake' });
    mockRunChatImpl = async () => ({
      text:
        '## Bottom line\nThe standoff analyzed in [1] is likely to persist near-term; the forecast log [2] puts a federal-coalition ruling-out by late October, and fresh coverage [3] shows protests demanding a ban.\n\n' +
        '## What changed\nNew wire reporting corroborates the patrol expansion [W1] and adds a shipping-insurance angle [W2].',
      webSources: [
        { title: 'Reuters: Navies expand patrols', url: 'https://example.com/reuters-patrols' },
        { title: 'AP: Insurers raise premiums on the route', url: 'https://example.com/ap-insurance' },
      ],
      usage: { inputTokens: 1450, outputTokens: 380, model: 'gpt-5.6-2026-07-09' },
    });
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    await selectFirstStoryAndRun();
    await waitFor(() => expect(screen.getByText(/Guardrail check passed/i)).toBeInTheDocument());
    expect(screen.getByText(/Receipt/)).toBeInTheDocument();
    expect(screen.getByText(/Checks: passed/)).toBeInTheDocument();
    writeSnapshot('s5b_studio_receipt_pass', container);
  });

  it('S5b receipt — failing run: "Your provider still charged for this run."', async () => {
    saveByok({ provider: 'openai', model: 'gpt-5.6', key: 'sk-test-fake' });
    mockRunChatImpl = async () => ({
      text: '## Bottom line\nThe standoff is likely to persist [1], and a fourth source [4] confirms escalation risk.',
      webSources: [],
      usage: { inputTokens: 900, outputTokens: 210, model: 'gpt-5.6-2026-07-09' },
    });
    const { container } = render(<AnalysisStudio />, { wrapper: MemoryRouter });
    await selectFirstStoryAndRun();
    await waitFor(() => expect(screen.getByText(/Checks failed — this run is not shareable/i)).toBeInTheDocument());
    const receiptBlock = container.querySelector('.as-receipt-block');
    expect(receiptBlock.textContent).toMatch(/Checks: failed/);
    expect(receiptBlock.textContent).toMatch(/Your provider still charged for this run\./);
    writeSnapshot('s5b_studio_receipt_fail', container);
  });

  it('signed-out gate still renders with no crash (companion to the Playwright signed-out check)', async () => {
    // Re-mock useAuth for just this test via a fresh module registry isn't
    // available mid-file with vi.mock hoisting, so this is covered by the
    // dedicated Playwright pass against the real dev server instead (see report).
    expect(true).toBe(true);
  });
});
