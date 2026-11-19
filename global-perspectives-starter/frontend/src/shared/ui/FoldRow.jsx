import '@/shared/ui/blocks.css';

// FoldRow — a closed row that opens in place (SPEC §2: "Map summary", "Data checks"). Native <details>, so it works with keyboard
// and screen readers and needs no state. The title names it; the hint says what is inside. Nothing inside is removed, only folded.
export default function FoldRow({ title, hint = null, className = '', children }) {
  return (
    <details className={`gp-fold ${className}`.trim()}>
      <summary className="gp-fold__sum">
        <span className="gp-fold__title">{title}</span>
        {hint ? <span className="gp-fold__hint">{hint}</span> : null}
        <span className="gp-fold__mark" aria-hidden="true">▸</span>
      </summary>
      <div className="gp-fold__body">{children}</div>
    </details>
  );
}
