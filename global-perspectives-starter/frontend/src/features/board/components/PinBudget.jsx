import { PIN_BUDGET } from '@/shared/lib/board.js';
import '@/features/board/presets.css';

// "Pin budget 7 / 12" with one segment per pin slot. The number carries the meaning; the fill is decoration.
export default function PinBudget({ used, max = PIN_BUDGET }) {
  return (
    <span className="pin-budget" role="img" aria-label={`Pin budget ${used} of ${max}`}>
      <span className="pin-budget__label" aria-hidden="true">Pin budget</span>
      <span className="pin-budget__count" aria-hidden="true">{used} / {max}</span>
      <span className="pin-budget__bar" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => <span key={i} className={i < used ? 'pin-budget__seg pin-budget__seg--on' : 'pin-budget__seg'} />)}
      </span>
    </span>
  );
}
