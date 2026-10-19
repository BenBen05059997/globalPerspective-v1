import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDailyBrief, MAX_LOOKBACK_DAYS } from '@/features/daily/hooks/useDailyBrief';
import { pausedSince } from '@/shared/lib/freshness';
import Card from '@/shared/ui/Card.jsx';
import StaticPage, { StaticSection } from '@/features/static/StaticPage.jsx';

export default function AboutContact() {
  useEffect(() => { document.title = 'About — Global Perspectives'; }, []);

  // F4 (review R2): "hundreds of articles daily" / "every hour" / "every 4 hours" were fixed-rate
  // claims the current (paused) pipeline can't back up — replaced with "when the pipeline runs"
  // wording, plus a real computed paused-since date rather than an invented number.
  const { brief: latestBrief, loading: briefLoading, error: briefError } = useDailyBrief();
  const paused = useMemo(() => pausedSince({
    newestAnalysisAt: latestBrief?.generatedAt,
    searched: !briefLoading && !briefError,
    lookbackDays: MAX_LOOKBACK_DAYS,
  }), [latestBrief, briefLoading, briefError]);

  return (
    <StaticPage title="About Global Perspectives" lede="AI-powered global news intelligence">
      <StaticSection title="What We Do">
        <p>
          Global Perspectives tracks how the world's biggest stories evolve across days, countries, and sources.
          When the pipeline runs, it processes new articles, identifies narrative threads, and generates
          structured intelligence briefings — so you can understand what's happening, why it matters, and what's next.
          {paused && (
            paused.beyondLookback
              ? ` Analysis is currently paused — ${paused.text}.`
              : ` Analysis has been paused since ${paused.label}.`
          )}
        </p>
      </StaticSection>

      <StaticSection title="How It Works">
        <div className="sp-steps">
          {[
            { step: '1', title: 'Collect', desc: 'RSS feeds + Brave Search surface global news from many sources when the collection pipeline runs.' },
            { step: '2', title: 'Analyze', desc: 'DeepSeek V4 identifies topics, assigns categories, and links articles into narrative threads.' },
            { step: '3', title: 'Synthesize', desc: 'AI generates summaries, predictions, root cause analysis, and country-level intelligence briefings.' },
            { step: '4', title: 'Visualize', desc: 'Interactive maps, timelines, and structured briefings make the intelligence accessible at a glance.' },
          ].map(s => (
            <Card key={s.step} level={2} pad="sm">
              <div className="sp-step__num">{s.step}</div>
              <div className="sp-step__title">{s.title}</div>
              <div className="sp-step__desc">{s.desc}</div>
            </Card>
          ))}
        </div>
      </StaticSection>

      <StaticSection title="Key Features">
        <ul className="sp-list">
          <li><strong>Daily Topics</strong> — ~13 global topics, refreshed with AI analysis when the pipeline runs</li>
          <li><strong>Story Arc Intelligence</strong> — track how stories evolve across days with narrative threading</li>
          <li><strong>Country Intelligence</strong> — AI-powered country briefings with risk levels, timelines, and watch triggers</li>
          <li><strong>Interactive World Map</strong> — geographic visualization of news connections and country replay</li>
          <li><strong>Structured Briefings</strong> — bottom-line assessments, key developments, and "why it matters" for every major story</li>
        </ul>
      </StaticSection>

      <StaticSection title="Our Sources">
        <p className="sp-note">
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
          <div key={g.region} className="sp-region">
            <div className="sp-region__name">{g.region}</div>
            <div className="sp-tags">
              {g.outlets.map(name => <span key={name} className="sp-tag">{name}</span>)}
            </div>
          </div>
        ))}
        <p className="sp-fine">* Sourced via Brave Search API (no RSS available)</p>
      </StaticSection>

      <StaticSection title="Who We Are">
        <p>
          Global Perspectives is built by an independent team passionate about making global news more
          accessible and understandable. We believe AI can help people see the connections between events
          that traditional news coverage misses.
        </p>
      </StaticSection>

      <StaticSection title="Contact">
        <p>
          Email: <a href="mailto:globalperspectives.app@gmail.com">globalperspectives.app@gmail.com</a>
        </p>
        <p className="sp-note">
          We welcome feedback, bug reports, feature suggestions, and partnership inquiries. We aim to respond within 2 business days.
        </p>
      </StaticSection>

      <StaticSection title="Learn More">
        <div className="sp-links">
          <Link to="/disclosures">Disclosures →</Link>
          <Link to="/privacy">Privacy & Terms →</Link>
        </div>
      </StaticSection>
    </StaticPage>
  );
}
