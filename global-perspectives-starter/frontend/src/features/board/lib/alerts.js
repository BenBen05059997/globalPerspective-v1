// Alert settings (artboard 9). The board schema has no field for alert choices and sending is not built, so these
// rows are never stored: they are the settings screen's state for this visit, derived from the board, dev harness only.
export const DELIVERY = [['instant', 'Instant'], ['daily', 'Daily digest'], ['weekly', 'Weekly only']];

/** The starting rows from the board. A row with no pin or string to name is not made. */
export function defaultAlertRows(board, labelOf) {
  const pin = board.pins.find((p) => p.kind === 'thread');
  const ours = board.strings.find((s) => s.owner === 'ours' && !s.cutAt);
  const yours = board.strings.find((s) => s.owner === 'yours' && !s.cutAt && s.line);
  const pair = (s) => `${labelOf(s.a)} — ${labelOf(s.b)}`;
  return [
    pin && { id: 'fired-pin', scope: 'pin', alert: 'Branch fired', applies: labelOf(pin.pinId), on: true, delivery: 'instant' },
    pin && board.pins.length > 1 && { id: 'fired-rest', scope: 'pin', alert: 'Branch fired', applies: 'All other pins', on: false, delivery: null },
    board.pins.length > 0 && { id: 'date', scope: 'pin', alert: 'A date is tomorrow', applies: 'All pins', on: true, delivery: 'daily' },
    { id: 'new-pin', scope: 'pin', alert: 'New pin we think belongs', applies: 'This board', on: true, delivery: 'weekly' },
    ours && { id: 'strength', scope: 'string', alert: 'Strength changed', applies: pair(ours), on: true, delivery: 'daily' },
    ours && board.strings.length > 1 && { id: 'strength-rest', scope: 'string', alert: 'Strength changed', applies: 'All other strings', on: true, delivery: 'weekly' },
    yours && { id: 'tested', scope: 'string', alert: 'My line was tested', applies: pair(yours), detail: `your line: “${yours.line}”`, on: true, delivery: 'daily' },
  ].filter(Boolean);
}
