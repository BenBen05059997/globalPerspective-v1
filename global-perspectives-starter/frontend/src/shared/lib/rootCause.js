const STEPS = [
  { key: 'proximate', label: 'Trigger' },
  { key: 'medium_term', label: 'Enabling condition' },
  { key: 'deeper_structural', label: 'Structural factor', alias: 'structural' },
];

export function rootCauseSteps(value) {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? [{ key: 'text', label: null, text }] : [];
  }
  if (!value || typeof value !== 'object') return [];
  return STEPS
    .map(({ key, label, alias }) => {
      const raw = value[key] ?? (alias ? value[alias] : undefined);
      return typeof raw === 'string' && raw.trim() ? { key, label, text: raw.trim() } : null;
    })
    .filter(Boolean);
}

export function rootCauseText(value) {
  return rootCauseSteps(value)
    .map(s => (s.label ? `${s.label}: ${s.text}` : s.text))
    .join('\n\n');
}
