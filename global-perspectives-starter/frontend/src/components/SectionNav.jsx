import { useState, useEffect, useRef, useCallback } from 'react';

export default function SectionNav({ sections }) {
  const [activeId, setActiveId] = useState(sections[0]?.id || '');
  const [stuck, setStuck] = useState(false);
  const navRef = useRef(null);
  const pillRefs = useRef({});

  // Scroll-spy via IntersectionObserver
  useEffect(() => {
    const els = sections.map(s => document.getElementById(s.id)).filter(Boolean);
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0.1 }
    );

    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  // Detect if nav is stuck (scrolled past its natural position)
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 1, rootMargin: '-1px 0px 0px 0px' }
    );
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll active pill into view
  useEffect(() => {
    const pill = pillRefs.current[activeId];
    if (pill) pill.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  const handleClick = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (sections.length < 2) return null;

  return (
    <nav ref={navRef} className={`section-nav ${stuck ? 'stuck' : ''}`}>
      <div className="section-nav-pills">
        {sections.map(s => (
          <button
            key={s.id}
            ref={el => pillRefs.current[s.id] = el}
            className={`section-nav-pill ${activeId === s.id ? 'active' : ''}`}
            onClick={() => handleClick(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
