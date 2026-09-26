// MapPhoneTabs — the phone pattern's single tab switch (P1) for /map: MAP (radar, default) ·
// LIST (the intel feed) · ALERTS (situations only, the GDACS/news alert stack). One row, 44px
// targets, standard tablist/tab/tabpanel roles so a screen reader announces the switch the same
// way native tabs would.
const TABS = [
  { key: 'map', label: 'Map' },
  { key: 'list', label: 'List' },
  { key: 'alerts', label: 'Alerts' },
];

export default function MapPhoneTabs({ active, onChange, alertCount = 0 }) {
  return (
    <div className="sh-phonetabs" role="tablist" aria-label="Map view">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          id={`sh-tab-${t.key}`}
          aria-selected={active === t.key}
          aria-controls={`sh-panel-${t.key}`}
          tabIndex={active === t.key ? 0 : -1}
          className={`sh-phonetab${active === t.key ? ' sh-phonetab-on' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.key === 'alerts' && alertCount > 0 ? <span className="sh-phonetab-count">{alertCount}</span> : null}
        </button>
      ))}
    </div>
  );
}
