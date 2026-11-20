import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import SiteGuide from '@/shared/ui/SiteGuide.jsx';
import HowWeRead from '@/shared/ui/HowWeRead.jsx';
import '@/app/layout/HelpPanel.css';

// HelpPanel — the "?" panel (SPEC round 5 R7): how the site works, over the current page, with no route change. Right side on
// desktop, a full sheet on a phone. It starts at the kinds (the pages already show the sentence), then "How we read the world".
// The Map's own About drawer (`/?about=1`, with the map's index and teasers) stays one link away. Esc, × or the scrim close it, and
// focus goes back to "?"; following a link closes it too.
export default function HelpPanel({ onClose, aboutTo, board = false }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <>
      <div className="gp-helppanel-scrim" onClick={onClose} aria-hidden="true" />
      <section ref={ref} className="gp-helppanel" role="dialog" aria-modal="true" aria-labelledby="gp-helppanel-title" tabIndex={-1}>
        <div className="gp-helppanel__head">
          <h2 id="gp-helppanel-title">How this site works</h2>
          <button type="button" className="gp-helppanel__close" onClick={onClose} aria-label="Close how this site works">×</button>
        </div>
        <SiteGuide onNavigate={onClose} board={board} />
        <HowWeRead />
        <p className="gp-helppanel__more"><Link to={aboutTo} onClick={onClose}>About this map: every open situation and the latest editions →</Link></p>
      </section>
    </>,
    document.body,
  );
}
