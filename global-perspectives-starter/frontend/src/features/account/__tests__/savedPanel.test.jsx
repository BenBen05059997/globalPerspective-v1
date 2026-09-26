// F2.21 (map-console review R1): the SavedPanel filter chips (including "All") used to disappear
// once savedItems.length dropped to 1 or fewer, even while a non-"all" filter was still selected —
// a reader who filtered to one type then unsaved items down to a mismatched single item had no
// visible way back to "All" (a dead end).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SavedPanel } from '@/features/account/components/SavedPanel.jsx';

const THREAD_ITEM = { itemType: 'thread', itemId: 't1', savedAt: '2026-09-20T00:00:00.000Z', metadata: { title: 'Thread one' } };
const COUNTRY_ITEM = { itemType: 'country', itemId: 'c1', savedAt: '2026-09-21T00:00:00.000Z', metadata: { name: 'Iran' } };

function renderPanel(items) {
  return render(
    <MemoryRouter>
      <SavedPanel savedItems={items} savedLoading={false} onUnsave={vi.fn()} />
    </MemoryRouter>
  );
}

describe('SavedPanel — filter chips', () => {
  it('shows no filter row with 0 or 1 saved item and no active filter', () => {
    renderPanel([THREAD_ITEM]);
    expect(screen.queryByRole('button', { name: /^all/i })).not.toBeInTheDocument();
  });

  it('keeps the "All" chip visible once a filter is active, even after items drop to one (no dead end)', () => {
    const { rerender } = renderPanel([THREAD_ITEM, COUNTRY_ITEM]);
    fireEvent.click(screen.getByRole('button', { name: /^country/i }));
    expect(screen.getByRole('button', { name: /^all/i })).toBeInTheDocument();

    // Simulate the country item having been unsaved — only the (non-matching) thread item is left,
    // but the "country" filter is still selected.
    rerender(
      <MemoryRouter>
        <SavedPanel savedItems={[THREAD_ITEM]} savedLoading={false} onUnsave={vi.fn()} />
      </MemoryRouter>
    );
    const allChip = screen.getByRole('button', { name: /^all/i });
    expect(allChip).toBeInTheDocument();
    fireEvent.click(allChip);
    expect(screen.getByText('Thread one')).toBeInTheDocument();
  });
});
