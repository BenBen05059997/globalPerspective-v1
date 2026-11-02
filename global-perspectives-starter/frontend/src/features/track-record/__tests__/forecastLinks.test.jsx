// ForecastLinks: the way back from one forecast. The story is a link only when the item carries a real
// thread id; every country its text names links to its country page; nothing to link -> nothing rendered.
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ForecastLinks from '@/features/track-record/components/ForecastLinks.jsx';

const mount = (item, className) => render(<MemoryRouter><ForecastLinks item={item} className={className} /></MemoryRouter>);

describe('ForecastLinks', () => {
  it('links the story (real thread id) and each country the question names, separated by dots', () => {
    const { container } = mount({
      clusterKey: 'thread-turkey-summit-1',
      storyTitle: 'Summit security in Turkey',
      question: 'Will Greece and Turkey hold talks before 1 December?',
    }, 'tr-fb-links');
    expect(screen.getByRole('link', { name: 'Summit security in Turkey' })).toHaveAttribute('href', '/weekly/thread/thread-turkey-summit-1');
    expect(screen.getByRole('link', { name: 'Greece' })).toHaveAttribute('href', '/weekly/country/Greece');
    expect(screen.getByRole('link', { name: 'Turkey' })).toHaveAttribute('href', '/weekly/country/Turkey');
    expect(container.firstChild).toHaveClass('tr-fb-links');
    expect(container.textContent).toMatch(/^Summit security in Turkey · [A-Za-z ]+ · [A-Za-z ]+$/);
  });

  it('an item whose clusterKey is a topic id (no thread) shows its title as plain text, not a link', () => {
    const { container } = mount({ clusterKey: 'some-topic-id-4', title: 'Border incident', trigger: 'Pakistan closes the crossing' });
    expect(screen.queryByRole('link', { name: 'Border incident' })).toBeNull();
    expect(container.textContent).toContain('Border incident');
    expect(screen.getByRole('link', { name: 'Pakistan' })).toHaveAttribute('href', '/weekly/country/Pakistan');
  });

  it('matches the site display name (UAE); aliases and long forms are deliberately not scanned', () => {
    mount({ title: 'Gulf shipping', trigger: 'UAE raises port fees' });
    expect(screen.getByRole('link', { name: 'UAE' })).toHaveAttribute('href', expect.stringContaining('/weekly/country/'));
    cleanup();
    const { container } = mount({ title: 'Gulf shipping', trigger: 'United Arab Emirates raises port fees' });
    expect(screen.queryByRole('link', { name: 'UAE' })).toBeNull();
    expect(container.textContent).toBe('Gulf shipping');
  });

  it('countries only, no title: no leading separator', () => {
    const { container } = mount({ question: 'Will India respond?' });
    expect(container.textContent).toBe('India');
  });

  it('prefers storyTitle over title', () => {
    const { container } = mount({ storyTitle: 'Story title', title: 'Other title', question: 'x' });
    expect(container.textContent).toContain('Story title');
    expect(container.textContent).not.toContain('Other title');
  });

  it('renders nothing when there is neither a title nor a named country', () => {
    const { container } = mount({ question: 'Will prices rise?' });
    expect(container.firstChild).toBeNull();
  });
});
