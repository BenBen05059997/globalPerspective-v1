// Batch 3 / D: the country card renders the stored facts row with source + checked date, and no row
// for a country without a sourced, dated fact. Data hooks are mocked (pure render test).
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const factsHolder = vi.hoisted(() => ({ value: null }));
vi.mock('@/features/countries/hooks/useCountryFacts.js', () => ({ useCountryFacts: () => ({ facts: factsHolder.value }) }));
vi.mock('@/features/countries/hooks/useCountryIntelligence.js', () => ({ useCountryIntelligence: () => ({ intelligence: {}, loading: false }) }));
vi.mock('@/features/countries/hooks/useCountryHistory.js', () => ({ useCountryHistory: () => ({ snapshots: [], driftNotes: [], loading: false }) }));
vi.mock('@/features/economy/hooks/useMarketsCountry.js', () => ({ useMarketsCountry: () => ({ data: null }) }));
vi.mock('@/features/countries/hooks/useCountryStories.js', () => ({ useCountryStories: () => ({ stories: [], deadlines: [], topicIdToThreadId: new Map(), loading: false }) }));

import CountryCardV2 from '@/features/countries/components/CountryCardV2.jsx';

const now = new Date().toISOString();

describe('CountryCardV2 stored facts row', () => {
  it('renders each fact with its source and checked date', () => {
    factsHolder.value = {
      leadership: { headOfState: { name: 'Sanae Takaichi', since: '2025-10-21' }, headOfGovernment: { name: 'Sanae Takaichi', since: '2025-10-21' }, source: 'wikidata', checkedAt: now },
      capital: { names: ['Tokyo'], source: 'wikidata', checkedAt: now },
      population: { value: 123802000, year: new Date().getUTCFullYear() - 1, source: 'wikidata', checkedAt: now },
    };
    const { container } = render(<MemoryRouter><CountryCardV2 name="Japan" /></MemoryRouter>);
    const rows = [...container.querySelectorAll('.ccv2-fact-stored')].map((e) => e.textContent);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/Sanae Takaichi Head of state & government \(since 2025-10-21\)Wikidata · checked/);
    expect(rows[1]).toMatch(/Tokyo CapitalWikidata · checked/);
    expect(rows[2]).toMatch(/123\.8M Population \(\d{4}\)Wikidata · checked/);
  });
  it('renders no facts row when there is nothing sourced and dated', () => {
    factsHolder.value = { capital: { names: ['Tokyo'], source: 'wikidata' } }; // no date
    const { container } = render(<MemoryRouter><CountryCardV2 name="Japan" /></MemoryRouter>);
    expect(container.querySelector('.ccv2-fact-stored')).toBeNull();
    factsHolder.value = null;
    const r2 = render(<MemoryRouter><CountryCardV2 name="Japan" /></MemoryRouter>);
    expect(r2.container.querySelector('.ccv2-fact-stored')).toBeNull();
  });
});
