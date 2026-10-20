import { describe, it, expect } from 'vitest';
import { formatCountrySheet } from '@/features/countries/lib/countryText.js';

const unknowns = ['Not graded: we hold no outlet reliability data.'];

describe('formatCountrySheet', () => {
  it('a country with nothing but the archive date still carries the marks line and the unknowns block', () => {
    const t = formatCountrySheet({ country: 'Japan', builtOn: '2026-10-20', unknowns });
    expect(t).toContain('GLOBAL PERSPECTIVES - Japan [1]');
    expect(t).toContain('Assembled from our archive on 2026-10-20.');
    expect(t).toContain("WHAT WE DON'T KNOW [INFERENCE]\n- Not graded: we hold no outlet reliability data.");
    expect(t).not.toMatch(/RISK|BOTTOM LINE|WHAT HAPPENED|FORECASTS/);
    expect(t).toContain('[1] https://globalperspective.net/weekly/country/Japan');
  });

  it('keeps the marks and turns every link into a numbered absolute footnote', () => {
    const t = formatCountrySheet({
      country: 'Japan', builtOn: '2026-10-20',
      intel: { riskScore: 62, bluf: 'A **bold** line.', riskSignals: ['Watch X'] },
      entries: [{ date: '2026-10-19', title: 'Quake hits', threadId: 't-1', sources: [{ source: 'BBC', url: 'https://bbc.com/a' }] }],
      totalArticles: 4, dayCount: 3,
      change: { asOf: '2026-10-19', eventTitle: 'Quake hits', threadId: 't-1', why: 'Damage widened.' },
      connections: [{ fromId: 't-1', fromTitle: 'Quake', toId: 't-2', toTitle: 'Supply cut', confidence: 'medium', lag: 'order unclear', mechanism: 'ports shut', cited: [{ date: '2026-10-18', title: 'Ports close' }] }],
      triggers: [{ label: 'Will rates change?', deadline: '2026-11-01', qid: 'q9' }],
      facts: [{ label: 'Capital', value: 'Tokyo', source: 'Wikidata', checkedAt: '2026-10-18T05:00:00Z' }],
      unknowns,
    });
    expect(t).toContain('RISK [MODEL JUDGMENT] - model score, not a measurement');
    expect(t).toContain('BOTTOM LINE [MODEL JUDGMENT]\nA bold line.');
    expect(t).toContain('[FACT] Trigger headline: Quake hits [');
    expect(t).toContain('[MODEL JUDGMENT] Why it changed: Damage widened.');
    expect(t).toContain('judged to feed into Supply cut');
    expect(t).toContain('order unclear');
    expect(t).not.toMatch(/caused/);
    expect(t).toContain('WHAT HAPPENED [FACT]');
    expect(t).toContain('BBC [');
    expect(t).toContain('FORECASTS [MODEL JUDGMENT] - our forecast, not reported fact');
    expect(t).toContain('COUNTRY FACTS [FACT]\n- Capital: Tokyo - Wikidata, checked 2026-10-18');
    // each footnote is absolute, numbered once, in order
    const notes = t.split('LINKS\n')[1].split('\n');
    expect(notes[0]).toBe('[1] https://globalperspective.net/weekly/country/Japan');
    expect(notes.every((n) => /^\[\d+\] https?:\/\//.test(n))).toBe(true);
    expect(notes).toContain('[3] https://bbc.com/a'.replace('[3]', `[${notes.findIndex((n) => n.endsWith('bbc.com/a')) + 1}]`));
    expect(notes.some((n) => n.endsWith('/track-record?q=q9'))).toBe(true);
    expect(t.match(/\/weekly\/thread\/t-1/g)).toHaveLength(1); // same address, one footnote
  });

  it('a thin sheet shows thin: no empty section headings', () => {
    const t = formatCountrySheet({ country: 'Japan', builtOn: '2026-10-20', entries: [], connections: [], triggers: [], facts: [], unknowns });
    expect(t).not.toMatch(/HOW IT CONNECTS|WHAT HAPPENED|COUNTRY FACTS|WHAT CHANGED/);
  });
});
