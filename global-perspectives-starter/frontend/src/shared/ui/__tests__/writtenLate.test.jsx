import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import WrittenLate from '@/shared/ui/WrittenLate.jsx';

const ok = { writtenAt: '2026-11-16T23:30:00.000Z', slot: '2026-11-15T12:15:00.000Z' };

describe('WrittenLate', () => {
  it('is plain text with the written and slot days', () => {
    const { container } = render(<WrittenLate entry={{ writtenLate: ok }} />);
    const p = container.querySelector('p.gp-late');
    expect(p.textContent).toBe('Written 16 Nov from articles saved on 15 Nov');
    expect(container.querySelector('a, button')).toBeNull();
  });
  it('renders nothing without a marker or with a malformed one', () => {
    expect(render(<WrittenLate entry={{}} />).container.innerHTML).toBe('');
    expect(render(<WrittenLate entry={{ writtenLate: { writtenAt: 'x', slot: ok.slot } }} />).container.innerHTML).toBe('');
  });
});
