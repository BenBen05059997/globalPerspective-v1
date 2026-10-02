// PhoneTabs — the phone pattern's single tab switch (REDESIGN_MASTER_PLAN §3.1 P1): one row of
// 44px tabs under the page header (READ / MAP / LOG ...), standard tablist/tab roles with the
// WAI-ARIA arrow-key behaviour. The caller renders the matching panel (`panelProps(key)` gives it
// the id / role / aria-labelledby that pair it with its tab) and only mounts what the active tab
// needs, so an expensive panel (a map) is not loaded until it is opened.
//   tabs     [{ key, label }]
//   active   the active key
//   onChange (key) => void
//   label    accessible name of the tablist
//   idBase   unique prefix for the ids (one switch per page)
export function phoneTabIds(idBase, key) {
  return { tab: `${idBase}-tab-${key}`, panel: `${idBase}-panel-${key}` };
}

export function phonePanelProps(idBase, key) {
  const ids = phoneTabIds(idBase, key);
  return { id: ids.panel, role: 'tabpanel', 'aria-labelledby': ids.tab, tabIndex: 0 };
}

export default function PhoneTabs({ tabs, active, onChange, label, idBase }) {
  const onKeyDown = (e) => {
    const { key } = e;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.key === active);
    let next;
    if (key === 'Home') next = 0;
    else if (key === 'End') next = tabs.length - 1;
    else if (key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else next = (i + 1) % tabs.length;
    onChange(tabs[next].key);
    requestAnimationFrame(() => document.getElementById(phoneTabIds(idBase, tabs[next].key).tab)?.focus());
  };
  return (
    <div className="gp-ptabs" role="tablist" aria-label={label} style={{ '--ptabs-n': tabs.length }} onKeyDown={onKeyDown}>
      {tabs.map((t) => {
        const ids = phoneTabIds(idBase, t.key);
        const on = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={on}
            aria-controls={ids.panel}
            tabIndex={on ? 0 : -1}
            className="gp-ptabs__btn"
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
