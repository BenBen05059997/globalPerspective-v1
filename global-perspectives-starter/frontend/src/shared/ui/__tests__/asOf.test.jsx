// AsOf — "as of <relative> (<absolute date>)" from the object's own timestamp, an optional source label,
// nothing at all without a real timestamp. asOfParts is the pure part.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AsOf from '@/shared/ui/AsOf.jsx';
import { asOfParts } from '@/shared/lib/age.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

describe('asOfParts', () => {
  it('relative + absolute + the one sentence', () => {
    const p = asOfParts('2026-10-19T07:00:00Z', NOW);
    expect(p.relative).toBe('5h ago');
    expect(p.absolute).toBe(day('2026-10-19T07:00:00Z'));
    expect(p.text).toBe(`as of 5h ago (${day('2026-10-19T07:00:00Z')})`);
    expect(p.iso).toBe('2026-10-19T07:00:00.000Z');
  });
  it('days, just now, and clock skew (a future stamp reads "just now")', () => {
    expect(asOfParts('2026-10-16T12:00:00Z', NOW).relative).toBe('3d ago');
    expect(asOfParts('2026-10-19T11:59:50Z', NOW).relative).toBe('just now');
    expect(asOfParts('2026-10-19T12:05:00Z', NOW).relative).toBe('just now');
  });
  it('missing or garbage -> null', () => {
    expect(asOfParts(null, NOW)).toBeNull();
    expect(asOfParts('nope', NOW)).toBeNull();
  });
});

describe('AsOf', () => {
  it('renders the line with a machine-readable time and the source label', () => {
    const { container } = render(<AsOf generatedAt="2026-10-19T07:00:00Z" source="story analysis" now={NOW} />);
    const t = container.querySelector('time');
    expect(t).toHaveAttribute('dateTime', '2026-10-19T07:00:00.000Z');
    expect(t).toHaveTextContent('as of 5h ago');
    expect(screen.getByText(/story analysis/)).toHaveClass('gp-asof__source');
    expect(container.firstChild).toHaveClass('gp-asof');
  });
  it('no source -> no label; no timestamp -> nothing', () => {
    const { container, rerender } = render(<AsOf generatedAt="2026-10-19T07:00:00Z" now={NOW} />);
    expect(container.querySelector('.gp-asof__source')).toBeNull();
    rerender(<AsOf generatedAt={undefined} now={NOW} />);
    expect(container.firstChild).toBeNull();
  });
});
