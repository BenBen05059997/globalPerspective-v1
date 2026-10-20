import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyAsText, WhatWeDontKnow, YourView } from '@/features/countries/components/CountrySheet.jsx';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe('CopyAsText', () => {
  it('writes the text to the clipboard inside the click', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<CopyAsText getText={() => 'the sheet'} />);
    fireEvent.click(screen.getByText('Copy as text'));
    expect(writeText).toHaveBeenCalledWith('the sheet');
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument());
  });
  it('falls back to a selected textarea when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
    render(<CopyAsText getText={() => 'the sheet'} />);
    fireEvent.click(screen.getByText('Copy as text'));
    const area = await screen.findByLabelText('Text to copy');
    expect(area.value).toBe('the sheet');
  });
});

describe('sheet blocks', () => {
  it('What we don\'t know is tagged INFERENCE', () => {
    render(<WhatWeDontKnow lines={['Not graded: we hold no outlet reliability data.']} />);
    expect(screen.getByText('INFERENCE')).toBeInTheDocument();
    expect(screen.getByText(/Not graded/)).toBeInTheDocument();
  });
  it('Your view is private, stored per country and survives a remount', () => {
    const { unmount } = render(<YourView country="Japan" />);
    expect(screen.getByText('YOURS')).toBeInTheDocument();
    expect(screen.getByText(/Private. Never sent to us./)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Your view of Japan/), { target: { value: 'my take' } });
    unmount();
    const again = render(<YourView country="Japan" />);
    expect(screen.getByLabelText(/Your view of Japan/).value).toBe('my take');
    again.unmount();
    render(<YourView country="Iran" />);
    expect(screen.getByLabelText(/Your view of Iran/).value).toBe('');
  });
});
