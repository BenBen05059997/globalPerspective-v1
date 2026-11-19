import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EntryRole from '@/shared/ui/EntryRole.jsx';

describe('EntryRole', () => {
  it.each([['start', 'Starts a story'], ['move', 'Moves a story'], ['measure', 'Measured change']])('%s reads %s as the kind chip', (role, word) => {
    render(<EntryRole role={role} />);
    const el = screen.getByText(word);
    expect(el.className).toBe('gp-kind');
    expect(el.getAttribute('data-kind')).toBe(role);
    expect(el.tagName).toBe('SPAN'); // a label, not a button
  });

  it('a measured change carries the MODEL JUDGMENT tag; start and move carry none', () => {
    const { rerender } = render(<EntryRole role="measure" />);
    expect(screen.getByText('MODEL JUDGMENT').className).toContain('claim-tag--judgment');
    for (const role of ['start', 'move']) {
      rerender(<EntryRole role={role} />);
      expect(screen.queryByText('MODEL JUDGMENT')).toBeNull();
    }
  });

  it('renders nothing for a null, missing or unknown role', () => {
    for (const role of [null, undefined, '', 'article', 'START']) {
      const { container, unmount } = render(<EntryRole role={role} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it('takes a caller class beside gp-cat', () => {
    render(<EntryRole role="move" className="story-entry-cat" />);
    expect(screen.getByText('Moves a story').className).toBe('gp-kind story-entry-cat');
  });
});
