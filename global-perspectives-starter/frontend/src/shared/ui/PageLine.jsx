import '@/shared/ui/blocks.css';

// PageLine — the one line under a page's top that says what the page holds (3-centre §3 "Tabs", SPEC §3, §4, §6).
export default function PageLine({ children, className = '' }) {
  return <p className={`gp-pageline ${className}`.trim()}>{children}</p>;
}
