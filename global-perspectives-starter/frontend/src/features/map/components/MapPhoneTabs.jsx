// MapPhoneTabs — the phone pattern's single tab switch (P1) for /map: MAP (radar, default) ·
// LIST (the intel feed) · ALERTS (situations only, the GDACS/news alert stack). One row, 44px
// targets, standard tablist/tab/tabpanel roles so a screen reader announces the switch the same
// way native tabs would.
const TABS = [
  { key: 'map', label: 'Map' },
  { key: 'list', label: 'List' },
  { key: 'alerts', label: 'Alerts' },
];

// F2.9: WAI-ARIA tabs pattern, automatic activation — ArrowLeft/ArrowRight move focus and select
// the adjacent tab (wrapping), Home/End jump to the first/last tab.
function handleKeyDown(e, onChange) {
  const { key } = e;
  if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
  e.preventDefault();
  const count = TABS.length;
  const currentIndex = TABS.findIndex((t) => `sh-tab-${t.key}` === e.currentTarget.dataset.activeId);
  let nextIndex;
  if (key === 'Home') nextIndex = 0;
  else if (key === 'End') nextIndex = count - 1;
  else if (key === 'ArrowLeft') nextIndex = (currentIndex - 1 + count) % count;
  else nextIndex = (currentIndex + 1) % count;
  const nextKey = TABS[nextIndex].key;
  onChange(nextKey);
  // Move DOM focus to the newly-selected tab after the re-render sets its tabIndex to 0.
  requestAnimationFrame(() => {
    document.getElementById(`sh-tab-${nextKey}`)?.focus();
  });
}

export default function MapPhoneTabs({ active, onChange, alertCount = 0 }) {
  return (
    <div
      className="sh-phonetabs"
      role="tablist"
      aria-label="Map view"
      data-active-id={`sh-tab-${active}`}
      onKeyDown={(e) => handleKeyDown(e, onChange)}
    >
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
