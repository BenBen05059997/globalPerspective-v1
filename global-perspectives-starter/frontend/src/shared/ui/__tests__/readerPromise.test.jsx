import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReaderPromise, { PROMISE } from '@/shared/ui/ReaderPromise.jsx';

describe('ReaderPromise', () => {
  it('prints the decision 0064 sentence word for word, as a paragraph by default', () => {
    expect(PROMISE).toBe('We follow the world’s stories day by day: how each began, what moved it today, and what to watch next.');
    render(<ReaderPromise />);
    const el = screen.getByText(PROMISE);
    expect(el.tagName).toBe('P');
    expect(el.className).toBe('gp-promise');
  });

  it('takes a heading tag and a caller class', () => {
    render(<ReaderPromise as="h1" className="x" />);
    expect(screen.getByRole('heading', { level: 1 }).className).toBe('gp-promise x');
  });
});
