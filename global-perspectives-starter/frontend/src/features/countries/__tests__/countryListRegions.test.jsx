// Batch 3 / F: CountryListPage must not list aggregates (Europe, Middle East ...) as countries and must
// not spend its 24 briefing-lookup slots on them.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const lookups = vi.hoisted(() => ({ names: null }));
const e = (regions, i) => ({ topicId: 't' + i, threadId: 'th' + i, title: 'x', category: 'politics', regions });
const entries = [];
for (let i = 0; i < 10; i++) entries.push(e(['Europe', 'France'], i));        // Europe 10, France 10
for (let i = 10; i < 16; i++) entries.push(e(['Middle East', 'Iran'], i));    // Middle East 6, Iran 6
for (let i = 16; i < 19; i++) entries.push(e(['Global', 'Japan'], i));        // Global 3, Japan 3
vi.mock('@/features/threads/hooks/useWeeklyArchive', () => ({ useWeeklyArchive: () => ({ dayMap: { '2026-09-30': { entries } }, sortedDates: ['2026-09-30'], loading: false }) }));
vi.mock('@/features/countries/hooks/useCountryIntelligence', () => ({ useCountryIntelligence: (names) => { lookups.names = names; return { intelligence: {} }; } }));
vi.mock('@/features/economy/hooks/useDisruptionsList', () => ({ useDisruptionsList: () => ({ data: [] }) }));
vi.mock('@/features/countries/components/CountryOverviewMap', () => ({ default: () => null }));

import CountryListPage from '@/features/countries/CountryListPage';

describe('CountryListPage region rule', () => {
  it('lists real countries only, and looks up briefings for real countries only', () => {
    const { container } = render(<MemoryRouter><CountryListPage /></MemoryRouter>);
    expect(lookups.names).toEqual(['France', 'Iran', 'Japan']);
    const text = container.textContent;
    for (const region of ['Europe', 'Middle East', 'Global']) expect(text).not.toMatch(new RegExp(`\\b${region}\\b`));
    for (const c of ['France', 'Iran', 'Japan']) expect(text).toMatch(new RegExp(c));
  });
});
