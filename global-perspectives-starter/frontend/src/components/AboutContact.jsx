import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function AboutContact() {
  useEffect(() => { document.title = 'About — Global Perspectives'; }, []);
  return (
    <div className="card" style={{ maxWidth: '880px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>About Global Perspectives</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        AI-powered global news intelligence
      </p>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>What We Do</h2>
        <p>
          Global Perspectives tracks how the world's biggest stories evolve across days, countries, and sources.
          Our AI pipeline processes hundreds of articles daily, identifies narrative threads, and generates
          structured intelligence briefings — so you can understand what's happening, why it matters, and what's next.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>How It Works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '12px' }}>
          {[
            { step: '1', title: 'Collect', desc: 'RSS feeds + Brave Search surface global news from hundreds of sources every hour.' },
            { step: '2', title: 'Analyze', desc: 'xAI Grok identifies topics, assigns categories, and links articles into narrative threads.' },
            { step: '3', title: 'Synthesize', desc: 'AI generates summaries, predictions, root cause analysis, and country-level intelligence briefings.' },
            { step: '4', title: 'Visualize', desc: 'Interactive maps, timelines, and structured briefings make the intelligence accessible at a glance.' },
          ].map(s => (
            <div key={s.step} style={{ padding: '14px', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '10px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6', marginBottom: '4px' }}>{s.step}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '4px' }}>{s.title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Key Features</h2>
        <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
          <li><strong>Daily Topics</strong> — ~13 global topics refreshed hourly with AI analysis</li>
          <li><strong>Story Arc Intelligence</strong> — track how stories evolve across days with narrative threading</li>
          <li><strong>Country Intelligence</strong> — AI-powered country briefings with risk levels, timelines, and watch triggers</li>
          <li><strong>Interactive World Map</strong> — geographic visualization of news connections and country replay</li>
          <li><strong>Structured Briefings</strong> — bottom-line assessments, key developments, and "why it matters" for every major story</li>
        </ul>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Our Sources</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          We aggregate from 29 outlets across every major region, combining RSS feeds with search APIs. No single source dominates our coverage.
        </p>
        {[
          { region: 'Global Wire Services', outlets: ['BBC World', 'Al Jazeera', 'Reuters*', 'AP News*'] },
          { region: 'Americas', outlets: ['NPR', 'CBC'] },
          { region: 'Europe', outlets: ['The Guardian', 'Deutsche Welle', 'EuroNews', 'France24'] },
          { region: 'Africa', outlets: ['AllAfrica', 'Daily Maverick', 'The East African'] },
          { region: 'Middle East', outlets: ['Middle East Eye', 'Al-Monitor'] },
          { region: 'Asia', outlets: ['SCMP', 'Asia Times', 'The Diplomat', 'Dawn', 'Japan Times', 'Channel News Asia', 'Nikkei Asia', 'Bangkok Post'] },
          { region: 'Oceania', outlets: ['ABC Australia'] },
          { region: 'Specialized', outlets: ['Straits Times*', 'Times of India*', 'Korea Herald*', 'Kyiv Independent*'] },
        ].map(g => (
          <div key={g.region} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{g.region}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {g.outlets.map(name => (
                <span key={name} style={{
                  fontSize: '0.8rem',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-secondary, #f8f8f8)',
                }}>{name}</span>
              ))}
            </div>
          </div>
        ))}
        <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '8px' }}>
          * Sourced via Brave Search API (no RSS available)
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Who We Are</h2>
        <p>
          Global Perspectives is built by an independent team passionate about making global news more
          accessible and understandable. We believe AI can help people see the connections between events
          that traditional news coverage misses.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Contact</h2>
        <p>
          Email: <a href="mailto:globalperspectives.app@gmail.com">globalperspectives.app@gmail.com</a>
        </p>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          We welcome feedback, bug reports, feature suggestions, and partnership inquiries. We aim to respond within 2 business days.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem' }}>Learn More</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
          <Link to="/whitepaper" style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>Read the White Paper →</Link>
          <Link to="/pricing" style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>View Pricing →</Link>
          <Link to="/disclosures" style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>Disclosures →</Link>
          <Link to="/privacy" style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>Privacy & Terms →</Link>
        </div>
      </section>
    </div>
  );
}
