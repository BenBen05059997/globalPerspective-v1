import { describe, it, expect } from 'vitest';
import { renumberWebCitations, extractCitedWebNumbers, webLinkMap } from '../webCitations.js';

describe('renumberWebCitations', () => {
  it('leaves prompt-compliant [Wn] markers untouched when nativeNumbering is off', () => {
    const text = 'Oil prices rose [1] after the strike, per new reporting [W1].';
    const webSources = [{ title: 'Wire', url: 'https://example.com/wire' }];
    const { text: out, webSources: numbered } = renumberWebCitations(text, webSources, { nativeNumbering: false });
    expect(out).toBe(text);
    expect(numbered).toEqual([{ n: 1, title: 'Wire', url: 'https://example.com/wire' }]);
  });

  it('renumbers native-provider [n] markers to [Wn], resolving the exact collision fixture (both kinds use [1])', () => {
    // Our own story is cited as [1] (from `citations`), and Perplexity's own
    // in-text marker for its ONE search result is ALSO literally "[1]" — the
    // documented collision (TRACK_RECORD_AND_STUDIO_RULING.md, critic 2).
    const text = 'Our story [1] says the strike began. New reporting [1] adds the death toll.';
    const webSources = [{ title: 'Wire report', url: 'https://example.com/wire' }];
    const { text: out, webSources: numbered } = renumberWebCitations(text, webSources, { nativeNumbering: true });
    // Native numbering treats every [1] in the prose as the provider's own web
    // citation space — both instances become [W1], never collide with our [n].
    expect(out).toBe('Our story [W1] says the strike began. New reporting [W1] adds the death toll.');
    expect(numbered).toEqual([{ n: 1, title: 'Wire report', url: 'https://example.com/wire' }]);
  });

  it('renumbers multiple native web sources in order, leaving higher story numbers alone when no matching web source exists', () => {
    const text = 'A [1] and B [2] agree; our own story [3] disagrees.';
    const webSources = [
      { title: 'A', url: 'https://example.com/a' },
      { title: 'B', url: 'https://example.com/b' },
    ];
    const { text: out } = renumberWebCitations(text, webSources, { nativeNumbering: true });
    expect(out).toBe('A [W1] and B [W2] agree; our own story [3] disagrees.');
  });

  it('drops non-http(s) URLs entirely (never numbered, never linked)', () => {
    const webSources = [
      { title: 'Good', url: 'https://example.com/ok' },
      { title: 'Bad', url: 'javascript:alert(1)' },
      { title: 'Also bad', url: 'data:text/html,evil' },
      { title: 'Missing', url: '' },
    ];
    const { webSources: numbered } = renumberWebCitations('text [1]', webSources, { nativeNumbering: true });
    expect(numbered).toEqual([{ n: 1, title: 'Good', url: 'https://example.com/ok' }]);
  });

  it('returns [] webSources and the original text when none are provided', () => {
    const { text, webSources } = renumberWebCitations('plain text [1]', [], { nativeNumbering: true });
    expect(text).toBe('plain text [1]');
    expect(webSources).toEqual([]);
  });
});

describe('extractCitedWebNumbers', () => {
  it('extracts unique [Wn] numbers in order, ignoring plain [n]', () => {
    expect(extractCitedWebNumbers('[1] then [W2] then [W1] then [W2] again')).toEqual([2, 1]);
  });
});

describe('webLinkMap', () => {
  it('builds a marker→href map for Markdown, keyed like "W1"', () => {
    const map = webLinkMap([{ n: 1, title: 'A', url: 'https://a.example' }, { n: 2, title: 'B', url: 'https://b.example' }]);
    expect(map).toEqual({ W1: 'https://a.example', W2: 'https://b.example' });
  });

  it('omits a non-http(s) url even if one slipped through', () => {
    const map = webLinkMap([{ n: 1, title: 'Bad', url: 'javascript:alert(1)' }]);
    expect(map).toEqual({});
  });
});
