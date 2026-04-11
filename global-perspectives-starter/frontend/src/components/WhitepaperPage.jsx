import { Link } from 'react-router-dom';

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  margin: '1rem 0 1.5rem',
  fontSize: '0.9rem',
};
const thStyle = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  borderBottom: '2px solid var(--border-color)',
  color: 'var(--text-muted)',
  fontWeight: 600,
};
const tdStyle = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid var(--border-color)',
  verticalAlign: 'top',
};

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Step({ number, title, children }) {
  return (
    <div style={{ marginBottom: '1.5rem', paddingLeft: '1rem', borderLeft: '3px solid #3b82f6' }}>
      <p style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#3b82f6' }}>Step {number} — {title}</p>
      {children}
    </div>
  );
}

function Capability({ label, description }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
      <span style={{ fontWeight: 700, minWidth: 110, color: 'var(--text-primary)', fontSize: '0.9rem', paddingTop: 2 }}>{label}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>{description}</span>
    </div>
  );
}

export default function WhitepaperPage() {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 0' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem', padding: '2.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12 }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>White Paper · 2026</p>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '0.75rem' }}>
          From Headlines to Intelligence
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontStyle: 'italic' }}>
          How AI-Powered Narrative Analysis Is Changing the Way the World Reads the News
        </p>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>globalperspective.net</p>
      </div>

      {/* Executive Summary */}
      <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid #3b82f6' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', color: '#3b82f6' }}>Executive Summary</h2>
        <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
          The world produces more news than any analyst, executive, or researcher can meaningfully process. Yet the problem is not a shortage of information — it is a shortage of <em>synthesis</em>. Headlines tell you what happened yesterday. They do not tell you why it happened, how it connects to last week's events, or what comes next.
        </p>
        <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
          Global Perspectives is an AI-powered geopolitical intelligence platform that transforms raw global news into structured, decision-ready insight — updated hourly, available to anyone. Built on a proprietary <strong>Narrative Arc Intelligence</strong> pipeline, it reads the world's news continuously, clusters events into evolving story threads, traces their root causes, and forecasts their likely trajectories.
        </p>
        <p style={{ lineHeight: 1.7, marginBottom: '1.25rem' }}>
          The result is not a faster news feed. It is a fundamentally different product: intelligence that shows how stories <em>move</em>, not just what happened today.
        </p>
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <p style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem', color: '#3b82f6' }}>KEY CAPABILITIES</p>
          <ul style={{ paddingLeft: '1.25rem', margin: 0, lineHeight: 1.8 }}>
            <li>Hourly AI analysis of 20+ international news sources across 6 continents</li>
            <li>Narrative threading that links related events across days and geographies</li>
            <li>AI-generated summaries, predictions, and root-cause analysis per topic</li>
            <li>Weekly narrative intelligence: story arcs, trajectory forecasts, watch questions</li>
            <li>Country-level intelligence briefings updated daily</li>
            <li>Interactive world map showing geopolitical connections in real time</li>
          </ul>
        </div>
      </div>

      {/* Part I */}
      <Section title="Part I: The Problem — Why More News Makes It Harder to Understand the World">
        <SubSection title="The Paradox of Information Abundance">
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            In 1980, a well-informed analyst subscribed to three newspapers, two wire services, and a weekly intelligence digest. The challenge was access: how do you get enough information?
          </p>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            In 2026, that same analyst faces the inverse problem. They have access to thousands of sources, updated in real time, in every language. The challenge is no longer access. It is <em>relevance</em> — knowing which of the ten thousand things that happened today actually matter, and why.
          </p>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            This is not a personal failure. It is a structural one. The global news ecosystem was not designed to synthesize; it was designed to publish. Every outlet publishes its own version of events. No outlet is responsible for connecting Tuesday's story to Thursday's consequence. No outlet tells you that the trade dispute you read about in January is the same story as the currency crisis you read about in March.
          </p>
          <p style={{ lineHeight: 1.7, fontStyle: 'italic', color: 'var(--text-muted)' }}>
            The result: even the most diligent reader finishes their morning briefing knowing more facts but understanding less of the world.
          </p>
        </SubSection>

        <SubSection title="The Western Lens Problem">
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            Compounding information overload is a geographic bias that most intelligence tools inherit without question. The majority of English-language news platforms draw from the same cluster of Western wire services — Reuters, Associated Press, Bloomberg — supplemented by a handful of major newspapers.
          </p>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            This is not malicious. It is structural. But it means that events in Southeast Asia, South Asia, the Middle East, and Africa are systematically underweighted — not because they matter less, but because the sources that cover them are less represented in the typical intelligence workflow.
          </p>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            A trade dispute in the South China Sea looks different from Singapore than from Washington. An election in Pakistan matters to a billion people before it becomes a wire service story in New York. A regional drought in the Horn of Africa is the context for a migration story that will not appear in Western media for another six months.
          </p>
          <p style={{ lineHeight: 1.7, fontStyle: 'italic', color: 'var(--text-muted)' }}>
            Intelligence without geographic diversity is not intelligence — it is a partial view that mistakes its limitations for comprehensiveness.
          </p>
        </SubSection>

        <SubSection title="The Snapshot Problem">
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            Even the best daily briefings share a fundamental flaw: they treat every day as a fresh start.
          </p>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            Events are not discrete. Stories are. The Ukraine energy infrastructure attack on a Tuesday is not a standalone event — it is chapter seven of a narrative that began eighteen months earlier. The central bank rate decision in Brazil this week is directly connected to the fiscal policy announcement three weeks ago and the currency pressure report two months before that.
          </p>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            When news is consumed as a daily snapshot, this continuity is invisible. Readers accumulate a growing pile of unconnected facts and wonder why their understanding of the world does not improve despite their increasing effort.
          </p>
          <p style={{ lineHeight: 1.7, fontStyle: 'italic', color: 'var(--text-muted)' }}>
            The analysts who understand the world best are not the ones who read more. They are the ones who remember how the story got here.
          </p>
        </SubSection>
      </Section>

      {/* Part II */}
      <Section title="Part II: The Solution — Narrative Arc Intelligence">
        <SubSection title="A Different Kind of AI Platform">
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            Global Perspectives was built around a single insight: <em>the unit of geopolitical understanding is not the headline — it is the narrative arc</em>.
          </p>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            A narrative arc is the through-line of a story across time: the initial trigger, the escalation, the turning points, the likely resolution. It is what a senior analyst sees when they look at the news; it is what most readers miss.
          </p>
          <p style={{ lineHeight: 1.7 }}>
            Our proprietary <strong>Narrative Arc Intelligence pipeline</strong> is designed to do exactly what a human expert does, at machine scale: read continuously, identify the thread running through apparently disconnected events, and produce structured intelligence that shows not just what happened, but how the story is moving.
          </p>
        </SubSection>

        <SubSection title="The Pipeline: From Sources to Intelligence">
          <Step number={1} title="Global Ingestion (Hourly)">
            <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
              Every hour, Global Perspectives ingests articles from a deliberately diverse set of international sources:
            </p>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Region</th>
                  <th style={thStyle}>Sources</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={tdStyle}>Western Europe &amp; Americas</td><td style={tdStyle}>BBC, The Guardian, France 24</td></tr>
                <tr><td style={tdStyle}>East Asia</td><td style={tdStyle}>South China Morning Post, The Japan Times, Asia Times</td></tr>
                <tr><td style={tdStyle}>South Asia</td><td style={tdStyle}>Dawn (Pakistan), The Diplomat</td></tr>
                <tr><td style={tdStyle}>Middle East &amp; Africa</td><td style={tdStyle}>Al Jazeera</td></tr>
                <tr><td style={tdStyle}>Wire services</td><td style={tdStyle}>Reuters, Associated Press, Deutsche Welle, Euronews</td></tr>
              </tbody>
            </table>
            <p style={{ lineHeight: 1.7 }}>
              This is not an accident of availability. It is a design choice. By reading the same events from sources in different regions with different editorial perspectives, the platform captures a more complete picture of what is actually happening — and why different actors are responding differently.
            </p>
          </Step>

          <Step number={2} title="AI Topic Clustering">
            <p style={{ lineHeight: 1.7 }}>
              The filtered article pool is sent to a frontier large language model, which performs geopolitical clustering: grouping related articles from different sources into coherent topic clusters, each representing a distinct world event. Each cluster is validated against the original source articles — a hallucination filter that ensures every source cited by the AI actually exists in the ingested pool. This is a non-negotiable quality gate.
            </p>
          </Step>

          <Step number={3} title="Three-Layer AI Analysis">
            <p style={{ lineHeight: 1.7, marginBottom: '0.75rem' }}>For each topic, the platform generates three distinct analytical outputs:</p>
            <Capability label="SUMMARY" description="What happened. A structured briefing covering the key actors, events, and stakes. Written for a reader who has 90 seconds, not 15 minutes." />
            <Capability label="PREDICTION" description="What comes next. A chain-reaction analysis: second and third-order consequences, likely winners and losers, probable policy responses. Forward-looking intelligence, not retrospective reporting." />
            <Capability label="TRACE CAUSE" description="Why it started. Historical context and root-cause analysis: the structural condition that made this event possible, the long-running tension or policy failure that this surfaces. The layer that transforms a news consumer into someone who actually understands the world." />
          </Step>

          <Step number={4} title="Narrative Threading">
            <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
              This is the capability that distinguishes Global Perspectives from every other AI news platform.
            </p>
            <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
              Each topic is assigned a persistent thread identifier that links it to related topics from previous days, through two mechanisms:
            </p>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8, marginBottom: '1rem' }}>
              <li><strong>Semantic continuity:</strong> When the AI clustering model identifies that today's topic is a continuation of a previous story, it flags this connection explicitly.</li>
              <li><strong>Similarity matching:</strong> A deterministic algorithm compares keywords, geographic regions, and categories across up to seven days of archive, identifying threads the AI may have missed.</li>
            </ul>
            <p style={{ lineHeight: 1.7, fontStyle: 'italic', color: 'var(--text-muted)' }}>
              The result: "Brazil Central Bank Rate Decision" today is automatically linked to last week's "Brazil Inflation Concerns" and the week before's "Brazil Currency Pressure Report" — and the reader can see the full arc of the story, not just today's chapter.
            </p>
          </Step>

          <Step number={5} title="Daily Narrative Intelligence">
            <p style={{ lineHeight: 1.7, marginBottom: '0.75rem' }}>
              Every day, the platform generates deeper intelligence for the top active narrative threads. Drawing on the full story arc across up to 30 days of archive, the Thread Intelligence module produces:
            </p>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
              <li><strong>Story arc:</strong> 2–3 paragraphs narrating how the story evolved, entry by entry, turning point by turning point</li>
              <li><strong>Trajectory:</strong> Where the story is concretely heading — named scenarios, specific actors, rough timeframes</li>
              <li><strong>Root cause chain:</strong> Three-layer analysis from immediate trigger to medium-term structural condition to deeper historical factor</li>
              <li><strong>Watch questions:</strong> Three specific, time-bound questions to monitor in the coming days</li>
            </ul>
          </Step>

          <Step number={6} title="Country Intelligence Briefings">
            <p style={{ lineHeight: 1.7 }}>
              Every day, the platform generates geopolitical intelligence briefings for the most-covered countries. Each briefing synthesizes all active story arcs involving that country — showing not just what individual stories are happening, but how they interact and compound. Each briefing includes a situation summary, cross-thread insight, trajectory analysis, specific risk signals, and an overall risk level assessment.
            </p>
          </Step>
        </SubSection>
      </Section>

      {/* Part III */}
      <Section title="Part III: Who It Is For">
        {[
          {
            title: 'The Globally-Minded Professional',
            body: 'Policy researchers, think tank analysts, international consultants, and development professionals who need to track multiple regions simultaneously, without a dedicated intelligence team. Global Perspectives gives them the synthesis layer that used to require either significant budget or significant time — or both.',
            useCase: 'A consultant preparing a risk assessment for a client entering Southeast Asian markets uses the country intelligence briefings and 30-day thread archives to build a structured picture of the political and economic landscape in two hours, rather than two days.',
          },
          {
            title: 'The Executive and Board Advisor',
            body: 'C-suite executives and board members responsible for geopolitical risk management. They do not need the full detail of every story — they need a reliable picture of which stories matter, how they are moving, and where the risk inflection points are.',
            useCase: 'A CFO at a multinational uses the weekly narrative analysis and risk signal alerts to brief the board on geopolitical exposures, without requiring a dedicated analyst or expensive subscription intelligence service.',
          },
          {
            title: 'The Researcher and Academic',
            body: 'International relations scholars, security studies researchers, and policy analysts who need to track the evolution of specific narratives over time — trade disputes, conflict escalations, diplomatic processes — across a broad range of sources.',
            useCase: 'A researcher tracking the evolution of Indo-Pacific maritime tensions uses the narrative thread view to see exactly how coverage of specific incidents shifted across Al Jazeera, SCMP, and Western wire services over a two-week period.',
          },
          {
            title: 'The Journalist and Editor',
            body: 'International journalists and editors who need to understand the context behind a developing story — what the relevant history is, how similar events have unfolded in the past, and what other stories are connected to the one they are covering.',
            useCase: 'A journalist covering a sudden shift in Southeast Asian trade policy uses the Trace Cause analysis to rapidly build the historical context for their piece, without spending hours on background research.',
          },
          {
            title: 'The Engaged Citizen',
            body: 'Professionals, students, and globally-curious readers who are frustrated with the fragmented, context-free nature of standard news consumption. They read widely but feel like their understanding of the world is not proportionate to the time they invest.',
            useCase: 'A reader who follows global affairs in their personal time uses the free daily topics and AI analysis as a structured morning briefing — 15 minutes that replaces an hour of fragmented reading with a clearer picture of what actually matters today.',
          },
        ].map(({ title, body, useCase }) => (
          <div key={title} style={{ marginBottom: '1.75rem', padding: '1.25rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.6rem' }}>{title}</h3>
            <p style={{ lineHeight: 1.7, marginBottom: '0.75rem', color: 'var(--text-muted)' }}>{body}</p>
            <p style={{ fontSize: '0.88rem', fontStyle: 'italic', color: 'var(--text-muted)', borderLeft: '3px solid var(--border-color)', paddingLeft: '0.75rem', margin: 0 }}>
              <strong>Typical use case:</strong> {useCase}
            </p>
          </div>
        ))}
      </Section>

      {/* Part IV */}
      <Section title="Part IV: The Platform">
        <SubSection title="Intelligence at Three Levels">
          {[
            {
              tier: 'Free — The Daily Picture',
              sub: 'Everything needed to understand today\'s world, at no cost. No account required.',
              items: [
                'Today\'s AI-clustered global topics, refreshed hourly',
                'AI Summary, Prediction, and Trace Cause analysis per topic',
                'Interactive world map with geopolitical connection lines',
                'Category-colored markers showing conflict, economy, politics, technology, health, and disaster stories',
                '24-hour topic archive',
              ],
              color: '#6b7280',
            },
            {
              tier: 'Member — The Narrative Layer',
              sub: 'For professionals who need to understand how stories evolve, not just what happened today.',
              items: [
                '7-day narrative archive',
                'Full weekly narrative view: stories grouped by thread, trend indicators (Rising / Stable / Fading / New)',
                'Thread Intelligence: story arc, trajectory, root cause chain, watch questions per thread',
                'Country Intelligence briefings: daily AI situation assessments for the world\'s most active countries',
                'Interactive weekly map with date playback',
                'Thread and country deep-dive pages',
              ],
              color: '#3b82f6',
            },
            {
              tier: 'Enterprise — The Full Intelligence Stack',
              sub: 'For organizations that need comprehensive historical intelligence, team access, and custom use.',
              items: [
                '30-day archive',
                'All Member features',
                'Priority access to new intelligence capabilities',
                'Enterprise account management',
              ],
              color: '#8b5cf6',
            },
          ].map(({ tier, sub, items, color }) => (
            <div key={tier} style={{ marginBottom: '1.25rem', padding: '1.25rem', border: `1px solid ${color}`, borderRadius: 8, borderLeft: `4px solid ${color}` }}>
              <p style={{ fontWeight: 700, color, marginBottom: '0.25rem' }}>{tier}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{sub}</p>
              <ul style={{ paddingLeft: '1.25rem', margin: 0, lineHeight: 1.8, fontSize: '0.9rem' }}>
                {items.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
        </SubSection>

        <SubSection title="The Map Experience">
          <p style={{ lineHeight: 1.7 }}>
            The Global Perspectives world map is not a geographic novelty — it is an intelligence tool. Each country marker represents the number of distinct geopolitical topics affecting that country. Geodesic connection lines link countries that share a story, creating a visual representation of geopolitical relationships that is updated hourly.
          </p>
          <p style={{ lineHeight: 1.7, marginTop: '0.75rem' }}>
            Clicking any country opens a side panel with all active topics affecting it, complete with AI analysis and connections to related countries. The weekly map adds a temporal dimension: date playback allows analysts to watch narratives spread geographically over time, seeing exactly when and how a story moved from one region to another.
          </p>
        </SubSection>
      </Section>

      {/* Part V */}
      <Section title="Part V: Design Principles">
        <SubSection title="Human Judgment at the Center">
          <p style={{ lineHeight: 1.7 }}>
            Global Perspectives generates analysis; it does not make decisions. Every AI output is labeled, structured, and traceable to source articles. The platform is designed to augment the analyst's judgment — to give them the structured synthesis and historical context that would take hours to assemble manually, so they can focus their judgment on what it does best: assessing what matters and deciding what to do.
          </p>
          <p style={{ lineHeight: 1.7, marginTop: '0.75rem' }}>
            The three-layer analysis structure (Summary / Prediction / Trace Cause) is deliberately organized around the three questions that define expert geopolitical judgment: <em>What happened? What comes next? Why did this start?</em> The AI provides structured inputs to each question; the analyst provides the answer.
          </p>
        </SubSection>

        <SubSection title="Source Transparency">
          <p style={{ lineHeight: 1.7 }}>
            Every topic cites its sources. Every AI analysis is grounded in articles from named, verifiable outlets. The platform does not generate analysis from synthetic data or model hallucinations — a hallucination filter at the ingestion layer ensures that every source cited in AI output actually appeared in the source pool. Analysts can trace every claim to its origin.
          </p>
        </SubSection>

        <SubSection title="Geographic Balance as a Design Constraint">
          <p style={{ lineHeight: 1.7 }}>
            The source list for Global Perspectives is not determined by what is easiest to access — it is determined by what is necessary for a genuinely global picture. Al Jazeera covers the Middle East and Africa with depth that no Western wire service matches. The South China Morning Post covers East Asia with a proximity and sourcing density that shapes what stories surface and how they are framed. Dawn covers South Asia from inside the region.
          </p>
          <p style={{ lineHeight: 1.7, marginTop: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
            This is not tokenism. It is an epistemic commitment: a platform called Global Perspectives cannot provide global intelligence if it only reads the world through a Western lens.
          </p>
        </SubSection>

        <SubSection title="Non-Partisan and Non-Prescriptive">
          <p style={{ lineHeight: 1.7 }}>
            The platform has no editorial position. AI analysis is generated from the source articles, not from a political framework. The platform does not tell users what to think about the events it covers — it tells them what the events are, why they happened, and where they appear to be heading. The conclusions are the reader's to draw.
          </p>
        </SubSection>
      </Section>

      {/* Part VI */}
      <Section title="Part VI: Why Now">
        <p style={{ lineHeight: 1.7, marginBottom: '1.25rem' }}>
          Three conditions have converged to make this platform possible in 2026 in a way that was not possible five years ago:
        </p>
        {[
          {
            heading: 'Frontier language models.',
            body: 'The quality of AI analysis available through today\'s frontier models is genuinely sufficient for geopolitical synthesis tasks. The gap between "AI-generated summary" and "analyst-quality briefing" has closed enough to produce outputs that save time without sacrificing reliability.',
          },
          {
            heading: 'The cost of global news intelligence has been prohibitive.',
            body: 'Stratfor, Oxford Analytica, Bloomberg Intelligence — the established players in geopolitical intelligence charge prices that make their products accessible only to large organizations with dedicated intelligence budgets. The analyst at a mid-sized consultancy, the researcher at a university, the executive at a regional company — all have the same need for geopolitical context, and none have had access to a tool designed for them.',
          },
          {
            heading: 'The fragmentation of global media has made synthesis more valuable than ever.',
            body: 'The collapse of the aggregated mass-media news environment has produced a world of diverse, distributed, high-quality sources — but no reliable mechanism for connecting them. The value of synthesis has never been higher.',
          },
        ].map(({ heading, body }) => (
          <div key={heading} style={{ marginBottom: '1.25rem', paddingLeft: '1rem', borderLeft: '3px solid #22c55e' }}>
            <p style={{ lineHeight: 1.7 }}>
              <strong>{heading}</strong> {body}
            </p>
          </div>
        ))}
      </Section>

      {/* Conclusion */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1rem' }}>Conclusion</h2>
        <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
          The question is not whether AI will transform how the world reads the news. It already has. The question is whether that transformation will produce more noise or more understanding.
        </p>
        <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
          Global Perspectives is built on the conviction that the right answer to information overload is not more information — it is better synthesis. That the right response to the fragmentation of global media is not to pick a side — it is to read across sides. And that the right use of AI in the intelligence workflow is not to replace the analyst's judgment, but to give it something worth judging.
        </p>
        <p style={{ lineHeight: 1.7, fontWeight: 600, fontSize: '1.05rem' }}>
          The world does not lack for headlines. It lacks for people who understand how the story got here, and where it is going.
        </p>
        <p style={{ lineHeight: 1.7, marginTop: '0.5rem', color: 'var(--text-muted)' }}>
          That is what we are building.
        </p>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '2.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, marginBottom: '2rem' }}>
        <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Try Global Perspectives free</p>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          No account required. For enterprise access, partnerships, or press inquiries, contact us below.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={{ padding: '0.7rem 1.75rem', background: '#3b82f6', color: '#fff', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: '0.95rem' }}>
            Explore the Platform
          </Link>
        </div>
      </div>

      {/* Disclaimer */}
      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Global Perspectives is an independent platform. It is not affiliated with any government, political party, or media organization. AI analysis is generated from publicly available news sources and does not represent the editorial position of any source outlet.
      </p>
    </div>
  );
}
