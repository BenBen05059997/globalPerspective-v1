import '@/shared/ui/primitives.css';

// Tabs — the one tab / segmented switch. Three looks, one behaviour (roving tabindex; ArrowLeft /
// ArrowRight wrap, Home / End jump; a click or key selects):
//   variant 'line'      section tabs: a row of tabs with an accent underline on the selected one
//           'phone'     the phone pattern's one switch per page: equal-width 44px mono tabs
//           'segmented' a compact switch between views of the same data (accent outline = selected);
//                       a radiogroup, because it switches a view in place rather than showing a panel
// 'line' and 'phone' are a real tablist: the caller renders the panel with `tabPanelProps(idBase, key)`
// and mounts only what the active tab needs.
//   tabs     [{ key, label, count? }]   `count` prints a dim number after the label
//   active   the selected key
//   onChange (key) => void
//   label    accessible name of the group
//   idBase   unique id prefix (one per switch on a page)
export function tabIds(idBase, key) {
  return { tab: `${idBase}-tab-${key}`, panel: `${idBase}-panel-${key}` };
}

export function tabPanelProps(idBase, key) {
  const ids = tabIds(idBase, key);
  return { id: ids.panel, role: 'tabpanel', 'aria-labelledby': ids.tab, tabIndex: 0 };
}

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

export default function Tabs({ tabs, active, onChange, label, idBase, variant = 'line', className = '' }) {
  const radio = variant === 'segmented';
  const onKeyDown = (e) => {
    if (!NAV_KEYS.has(e.key)) return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.key === active);
    const n = tabs.length;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : e.key === 'ArrowLeft' ? (i - 1 + n) % n : (i + 1) % n;
    onChange(tabs[next].key);
    requestAnimationFrame(() => document.getElementById(tabIds(idBase, tabs[next].key).tab)?.focus());
  };
  return (
    <div
      className={`gp-tabs gp-tabs--${variant} ${className}`.trim()}
      role={radio ? 'radiogroup' : 'tablist'}
      aria-label={label}
      style={variant === 'phone' ? { '--tabs-n': tabs.length } : undefined}
      onKeyDown={onKeyDown}
    >
      {tabs.map((t) => {
        const ids = tabIds(idBase, t.key);
        const on = active === t.key;
        const state = radio
          ? { role: 'radio', 'aria-checked': on }
          : { role: 'tab', 'aria-selected': on, 'aria-controls': ids.panel };
        return (
          <button
            key={t.key}
            type="button"
            id={ids.tab}
            {...state}
            tabIndex={on ? 0 : -1}
            className="gp-tabs__tab"
            onClick={() => onChange(t.key)}
          >
            {t.label}
            {t.count != null ? <span className="gp-tabs__count">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
