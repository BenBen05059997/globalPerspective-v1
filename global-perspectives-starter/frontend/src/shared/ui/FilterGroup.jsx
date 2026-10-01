import { useId } from 'react';
import '@/shared/ui/blocks.css';

// FilterGroup — a labelled group of checkboxes (multi) or radios (single), 44px rows, real inputs.
//   options  [{ value, label, count? }]
//   type     'checkbox' (value = array, onChange(nextArray)) | 'radio' (value = string, onChange(next))
export default function FilterGroup({ label, options = [], value, onChange, type = 'checkbox', name, className = '' }) {
  const auto = useId();
  const group = name || auto;
  const multi = type !== 'radio';
  const selected = multi ? (Array.isArray(value) ? value : []) : value;
  const toggle = (v) => {
    if (!onChange) return;
    if (!multi) { onChange(v); return; }
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  return (
    <fieldset className={`gp-filter ${className}`.trim()}>
      <legend className="gp-filter__legend">{label}</legend>
      {options.map((o) => {
        const checked = multi ? selected.includes(o.value) : selected === o.value;
        return (
          <label key={o.value} className="gp-filter__opt">
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={group}
              value={o.value}
              checked={checked}
              onChange={() => toggle(o.value)}
            />
            <span className="gp-filter__text">{o.label}</span>
            {o.count != null ? <span className="gp-filter__count">{o.count}</span> : null}
          </label>
        );
      })}
    </fieldset>
  );
}
