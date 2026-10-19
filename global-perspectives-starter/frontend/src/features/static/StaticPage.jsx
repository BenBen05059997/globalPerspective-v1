import Card from '@/shared/ui/Card.jsx';
import '@/features/static/StaticPage.css';

// The one layout for the static pages (about, contact, privacy, disclosures): a centred Card with the
// page title, an optional lede, and prose sections. The white paper uses the same classes without the
// outer card (it is a run of cards).
//   width  'md' (720) | 'lg' (880, default)
export default function StaticPage({ title, lede = null, width = 'lg', children }) {
  return (
    <Card as="article" className={`sp-wrap sp-wrap--${width}`}>
      <h1 className="sp-title">{title}</h1>
      {lede ? <p className="sp-lede">{lede}</p> : null}
      {children}
    </Card>
  );
}

export function StaticSection({ title, children }) {
  return (
    <section className="sp-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
