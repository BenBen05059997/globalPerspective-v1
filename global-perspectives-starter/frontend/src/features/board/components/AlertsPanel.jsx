import { useState } from 'react';
import Card from '@/shared/ui/Card.jsx';
import Chip from '@/shared/ui/Chip.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import { DELIVERY, defaultAlertRows } from '@/features/board/lib/alerts.js';
import '@/features/board/alerts.css';

// "Alerts, per pin and per string" (artboard 9): settings only. Nothing here is stored (the board has no field for
// it) and nothing is sent; the choices last for this visit. A switched-off row shows "no alert" in place of delivery.
export default function AlertsPanel({ board, labelOf }) {
  const [rows, setRows] = useState(() => defaultAlertRows(board, labelOf));
  const [quiet, setQuiet] = useState(false);
  const patch = (id, change) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));
  const toggle = (r) => patch(r.id, { on: !r.on, delivery: r.on ? null : 'weekly' });

  const group = (scope, title) => {
    const list = rows.filter((r) => r.scope === scope);
    if (!list.length) return null;
    return (
      <section className="al-sec" aria-label={title}>
        <h3 className="pn-kicker">{title}</h3>
        <ul className="al-rows">
          {list.map((r) => {
            const live = r.on && !quiet;
            return (
              <li key={r.id} className="al-row">
                <span className="al-what"><strong>{r.alert}</strong> <span>{r.applies}{r.detail ? ` · ${r.detail}` : ''}</span></span>
                <Chip selected={live} disabled={quiet} onClick={() => toggle(r)} aria-label={`${r.alert}, ${r.applies}`}>{live ? 'On' : 'Off'}</Chip>
                <span className="al-delivery" role="group" aria-label={`Delivery for ${r.alert}, ${r.applies}`}>
                  {live ? DELIVERY.map(([key, word]) => (
                    <Chip key={key} selected={r.delivery === key} onClick={() => patch(r.id, { delivery: key })}>{word}</Chip>
                  )) : <span className="board-note">no alert</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <Card as="section" aria-label="Alerts" className="al-card">
      <SectionHeader label="Alerts, per pin and per string" hint="Settings only. Nothing is sent yet." as="h2" />
      <div className="al-row">
        <span className="al-what"><strong>Quiet board</strong> <span>weekly only, no alerts</span></span>
        <Chip selected={quiet} onClick={() => setQuiet(!quiet)} aria-label="Quiet board: weekly only, no alerts">{quiet ? 'On' : 'Off'}</Chip>
      </div>
      {group('pin', 'Per pin')}
      {group('string', 'Per string')}
    </Card>
  );
}
