import { useState, useEffect } from 'react';

export default function SideNav({ sections }) {
  const [activeId, setActiveId] = useState(sections[0]?.id || '');

  useEffect(() => {
    const els = sections.map(s => document.getElementById(s.id)).filter(Boolean);
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0.1 }
    );

    els.forEach(el => observer.observe(el));

    // When scrolled to bottom, activate last section
    function handleScroll() {
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 50;
      if (atBottom && sections.length > 0) {
        setActiveId(sections[sections.length - 1].id);
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [sections]);

  function handleClick(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav className="side-nav">
      {sections.map(s => (
        <button
          key={s.id}
          className={`side-nav-item ${activeId === s.id ? 'active' : ''}`}
          onClick={() => handleClick(s.id)}
        >
          <span className="side-nav-label">{s.label}</span>
          {s.count != null && <span className="side-nav-count">{s.count}</span>}
        </button>
      ))}
    </nav>
  );
}
