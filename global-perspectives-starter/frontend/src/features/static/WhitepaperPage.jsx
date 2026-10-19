import { useEffect } from 'react';
import Card from '@/shared/ui/Card.jsx';
import Button from '@/shared/ui/Button.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import '@/features/static/StaticPage.css';

function Section({ title, children }) {
  return (
    <section className="sp-part">
      <h2 className="sp-part__title">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }) {
  return (
    <div className="sp-sub">
      <h3 className="sp-sub__title">{title}</h3>
      {children}
    </div>
  );
}

function Step({ number, title, children }) {
  return (
    <div className="sp-rule">
      <p className="sp-rule__title">Step {number} — {title}</p>
      {children}
    </div>
  );
}

function Capability({ label, description }) {
  return (
    <div className="sp-cap">
      <span className="sp-cap__label">{label}</span>
      <span className="sp-cap__desc">{description}</span>
    </div>
  );
}

export default function WhitepaperPage() {
  useEffect(() => { document.title = 'White Paper | Global Perspectives'; }, []);
  return (
    <div className="sp-wrap sp-wrap--paper sp-paper">

      {/* Header */}
      <Card className="sp-hero">
        <p className="sp-kicker">White Paper · 2026</p>
        <h1 className="sp-hero__title">
          From Headlines to Intelligence
        </h1>
        <p className="sp-hero__sub">
          How AI-Powered Narrative Analysis Is Changing the Way the World Reads the News
        </p>
        <p className="sp-note">globalperspective.net</p>
      </Card>

      {/* Executive Summary */}
      <Card className="sp-paper-card sp-lead">
        <h2 className="sp-lead__title">Executive Summary</h2>
        <p>
          The world produces more news than any analyst, executive, or researcher can meaningfully process. Yet the problem is not a shortage of information — it is a shortage of <em>synthesis</em>. Headlines tell you what happened yesterday. They do not tell you why it happened, how it connects to last week's events, or what comes next.
        </p>
        <p>
          Global Perspectives is an AI-powered geopolitical intelligence platform that transforms raw global news into structured, decision-ready insight — updated every few hours, available to anyone. Built on a proprietary <strong>Narrative Arc Intelligence</strong> pipeline, it reads the world's news continuously, clusters events into evolving story threads, traces their root causes, and forecasts their likely trajectories.
        </p>
        <p>
          The result is not a faster news feed. It is a fundamentally different product: intelligence that shows how stories <em>move</em>, not just what happened today.
        </p>
        <div>
          <SectionHeader as="h3" label="Key capabilities" />
          <ul className="sp-list">
            <li>AI analysis of 20+ international news sources across 6 continents, refreshed every 4 hours</li>
            <li>Narrative threading that links related events across days and geographies</li>
            <li>AI-generated summaries, predictions, and root-cause analysis per topic</li>
            <li>Weekly narrative intelligence: story arcs, trajectory forecasts, watch questions</li>
            <li>Country-level intelligence briefings updated daily</li>
            <li>Interactive world map showing geopolitical connections in real time</li>
          </ul>
        </div>
      </Card>

      {/* Part I */}
      <Section title="Part I: The Problem — Why More News Makes It Harder to Understand the World">
        <SubSection title="The Paradox of Information Abundance">
          <p>
            In 1980, a well-informed analyst subscribed to three newspapers, two wire services, and a weekly intelligence digest. The challenge was access: how do you get enough information?
          </p>
          <p>
            In 2026, that same analyst faces the inverse problem. They have access to thousands of sources, updated in real time, in every language. The challenge is no longer access. It is <em>relevance</em> — knowing which of the ten thousand things that happened today actually matter, and why.
          </p>
          <p>
            This is not a personal failure. It is a structural one. The global news ecosystem was not designed to synthesize; it was designed to publish. Every outlet publishes its own version of events. No outlet is responsible for connecting Tuesday's story to Thursday's consequence. No outlet tells you that the trade dispute you read about in January is the same story as the currency crisis you read about in March.
          </p>
          <p className="sp-quiet">
            The result: even the most diligent reader finishes their morning briefing knowing more facts but understanding less of the world.
          </p>
        </SubSection>

        <SubSection title="The Western Lens Problem">
          <p>
            Compounding information overload is a geographic bias that most intelligence tools inherit without question. The majority of English-language news platforms draw from the same cluster of Western wire services — Reuters, Associated Press, Bloomberg — supplemented by a handful of major newspapers.
          </p>
          <p>
            This is not malicious. It is structural. But it means that events in Southeast Asia, South Asia, the Middle East, and Africa are systematically underweighted — not because they matter less, but because the sources that cover them are less represented in the typical intelligence workflow.
          </p>
          <p>
            A trade dispute in the South China Sea looks different from Singapore than from Washington. An election in Pakistan matters to a billion people before it becomes a wire service story in New York. A regional drought in the Horn of Africa is the context for a migration story that will not appear in Western media for another six months.
          </p>
          <p className="sp-quiet">
            Intelligence without geographic diversity is not intelligence — it is a partial view that mistakes its limitations for comprehensiveness.
          </p>
        </SubSection>

        <SubSection title="The Snapshot Problem">
          <p>
            Even the best daily briefings share a fundamental flaw: they treat every day as a fresh start.
          </p>
          <p>
            Events are not discrete. Stories are. The Ukraine energy infrastructure attack on a Tuesday is not a standalone event — it is chapter seven of a narrative that began eighteen months earlier. The central bank rate decision in Brazil this week is directly connected to the fiscal policy announcement three weeks ago and the currency pressure report two months before that.
          </p>
          <p>
            When news is consumed as a daily snapshot, this continuity is invisible. Readers accumulate a growing pile of unconnected facts and wonder why their understanding of the world does not improve despite their increasing effort.
          </p>
          <p className="sp-quiet">
            The analysts who understand the world best are not the ones who read more. They are the ones who remember how the story got here.
          </p>
        </SubSection>
      </Section>

      {/* Part II */}
      <Section title="Part II: The Solution — Narrative Arc Intelligence">
        <SubSection title="A Different Kind of AI Platform">
          <p>
            Global Perspectives was built around a single insight: <em>the unit of geopolitical understanding is not the headline — it is the narrative arc</em>.
          </p>
          <p>
            A narrative arc is the through-line of a story across time: the initial trigger, the escalation, the turning points, the likely resolution. It is what a senior analyst sees when they look at the news; it is what most readers miss.
          </p>
          <p>
            Our proprietary <strong>Narrative Arc Intelligence pipeline</strong> is designed to do exactly what a human expert does, at machine scale: read continuously, identify the thread running through apparently disconnected events, and produce structured intelligence that shows not just what happened, but how the story is moving.
          </p>
        </SubSection>

        <SubSection title="The Pipeline: From Sources to Intelligence">
          <Step number={1} title="Global Ingestion (Every 4 Hours)">
            <p>
              Every 4 hours, Global Perspectives ingests articles from a deliberately diverse set of international sources:
            </p>
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Sources</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Western Europe &amp; Americas</td><td>BBC, The Guardian, France 24</td></tr>
                <tr><td>East Asia</td><td>South China Morning Post, The Japan Times, Asia Times</td></tr>
                <tr><td>South Asia</td><td>Dawn (Pakistan), The Diplomat</td></tr>
                <tr><td>Middle East &amp; Africa</td><td>Al Jazeera</td></tr>
                <tr><td>Wire services</td><td>Reuters, Associated Press, Deutsche Welle, Euronews</td></tr>
              </tbody>
            </table>
            <p>
              This is not an accident of availability. It is a design choice. By reading the same events from sources in different regions with different editorial perspectives, the platform captures a more complete picture of what is actually happening — and why different actors are responding differently.
            </p>
          </Step>

          <Step number={2} title="AI Topic Clustering">
            <p>
              The filtered article pool is sent to a frontier large language model, which performs geopolitical clustering: grouping related articles from different sources into coherent topic clusters, each representing a distinct world event. Each cluster is validated against the original source articles — a hallucination filter that ensures every source cited by the AI actually exists in the ingested pool. This is a non-negotiable quality gate.
            </p>
          </Step>

          <Step number={3} title="Three-Layer AI Analysis">
            <p>For each topic, the platform generates three distinct analytical outputs:</p>
            <Capability label="SUMMARY" description="What happened. A structured briefing covering the key actors, events, and stakes. Written for a reader who has 90 seconds, not 15 minutes." />
            <Capability label="PREDICTION" description="What comes next. A chain-reaction analysis: second and third-order consequences, likely winners and losers, probable policy responses. Forward-looking intelligence, not retrospective reporting." />
            <Capability label="TRACE CAUSE" description="Why it started. Historical context and root-cause analysis: the structural condition that made this event possible, the long-running tension or policy failure that this surfaces. The layer that transforms a news consumer into someone who actually understands the world." />
          </Step>

          <Step number={4} title="Narrative Threading">
            <p>
              This is the capability that distinguishes Global Perspectives from every other AI news platform.
            </p>
            <p>
              Each topic is assigned a persistent thread identifier that links it to related topics from previous days, through two mechanisms:
            </p>
            <ul className="sp-list">
              <li><strong>Semantic continuity:</strong> When the AI clustering model identifies that today's topic is a continuation of a previous story, it flags this connection explicitly.</li>
              <li><strong>Similarity matching:</strong> A deterministic algorithm compares keywords, geographic regions, and categories across up to seven days of archive, identifying threads the AI may have missed.</li>
            </ul>
            <p className="sp-quiet">
              The result: "Brazil Central Bank Rate Decision" today is automatically linked to last week's "Brazil Inflation Concerns" and the week before's "Brazil Currency Pressure Report" — and the reader can see the full arc of the story, not just today's chapter.
            </p>
          </Step>

          <Step number={5} title="Daily Narrative Intelligence">
            <p>
              Every day, the platform generates deeper intelligence for the top active narrative threads. Drawing on the full story arc across up to 30 days of archive, the Thread Intelligence module produces:
            </p>
            <ul className="sp-list">
              <li><strong>Story arc:</strong> 2–3 paragraphs narrating how the story evolved, entry by entry, turning point by turning point</li>
              <li><strong>Trajectory:</strong> Where the story is concretely heading — named scenarios, specific actors, rough timeframes</li>
              <li><strong>Root cause chain:</strong> Three-layer analysis from immediate trigger to medium-term structural condition to deeper historical factor</li>
              <li><strong>Watch questions:</strong> Three specific, time-bound questions to monitor in the coming days</li>
            </ul>
          </Step>

          <Step number={6} title="Country Intelligence Briefings">
            <p>
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
          <Card key={title} className="sp-paper-card sp-stack">
            <h3 className="sp-card__title">{title}</h3>
            <p className="sp-card__body">{body}</p>
            <p className="sp-usecase">
              <strong>Typical use case:</strong> {useCase}
            </p>
          </Card>
        ))}
      </Section>

      {/* Part IV */}
      <Section title="Part IV: The Platform">
        <SubSection title="Intelligence at Three Levels">
          <p>
            All three levels are <strong>free and public to read</strong> — the levels below describe increasing
            depth of analysis, not a paywall. An optional membership never paywalls reading; it adds depth for
            members (the full self-correction history and change-alerts when a followed country&apos;s read moves)
            and runs the Analysis Studio on our servers.
          </p>
          {[
            {
              tier: 'Level 1 — The Daily Picture',
              sub: 'Everything needed to understand today\'s world. No account required.',
              items: [
                'Today\'s AI-clustered global topics, refreshed every 4 hours',
                'AI Summary, Prediction, and Trace Cause analysis per topic',
                'Interactive world map with geopolitical connection lines',
                'Category-colored markers showing conflict, economy, politics, technology, health, and disaster stories',
                '24-hour topic archive',
              ],
            },
            {
              tier: 'Level 2 — The Narrative Layer',
              sub: 'For readers who need to understand how stories evolve, not just what happened today.',
              items: [
                '7-day narrative archive',
                'Full weekly narrative view: stories grouped by thread, trend indicators (Rising / Stable / Fading / New)',
                'Thread Intelligence: story arc, trajectory, root cause chain, watch questions per thread',
                'Country Intelligence briefings: daily AI situation assessments for the world\'s most active countries',
                'Interactive weekly map with date playback',
                'Thread and country deep-dive pages',
              ],
            },
            {
              tier: 'Level 3 — The Full Intelligence Stack',
              sub: 'Comprehensive historical and cross-domain intelligence.',
              items: [
                '30-day archive',
                'All narrative-layer features',
                'Economic disruption analysis and cross-domain causal graphs',
                'Pair and systems-level intelligence',
              ],
            },
          ].map(({ tier, sub, items }) => (
            <Card key={tier} className="sp-paper-card sp-stack">
              <p className="sp-card__title">{tier}</p>
              <p className="sp-card__sub">{sub}</p>
              <ul className="sp-list">
                {items.map(item => <li key={item}>{item}</li>)}
              </ul>
            </Card>
          ))}
        </SubSection>

        <SubSection title="The Map Experience">
          <p>
            The Global Perspectives world map is not a geographic novelty — it is an intelligence tool. Each country marker represents the number of distinct geopolitical topics affecting that country. Geodesic connection lines link countries that share a story, creating a visual representation of geopolitical relationships that is updated every few hours.
          </p>
          <p>
            Clicking any country opens a side panel with all active topics affecting it, complete with AI analysis and connections to related countries. The weekly map adds a temporal dimension: date playback allows analysts to watch narratives spread geographically over time, seeing exactly when and how a story moved from one region to another.
          </p>
        </SubSection>
      </Section>

      {/* Part V */}
      <Section title="Part V: Design Principles">
        <SubSection title="Human Judgment at the Center">
          <p>
            Global Perspectives generates analysis; it does not make decisions. Every AI output is labeled, structured, and traceable to source articles. The platform is designed to augment the analyst's judgment — to give them the structured synthesis and historical context that would take hours to assemble manually, so they can focus their judgment on what it does best: assessing what matters and deciding what to do.
          </p>
          <p>
            The three-layer analysis structure (Summary / Prediction / Trace Cause) is deliberately organized around the three questions that define expert geopolitical judgment: <em>What happened? What comes next? Why did this start?</em> The AI provides structured inputs to each question; the analyst provides the answer.
          </p>
        </SubSection>

        <SubSection title="Source Transparency">
          <p>
            Every topic cites its sources. Every AI analysis is grounded in articles from named, verifiable outlets. The platform does not generate analysis from synthetic data or model hallucinations — a hallucination filter at the ingestion layer ensures that every source cited in AI output actually appeared in the source pool. Analysts can trace every claim to its origin.
          </p>
        </SubSection>

        <SubSection title="Geographic Balance as a Design Constraint">
          <p>
            The source list for Global Perspectives is not determined by what is easiest to access — it is determined by what is necessary for a genuinely global picture. Al Jazeera covers the Middle East and Africa with depth that no Western wire service matches. The South China Morning Post covers East Asia with a proximity and sourcing density that shapes what stories surface and how they are framed. Dawn covers South Asia from inside the region.
          </p>
          <p className="sp-quiet">
            This is not tokenism. It is an epistemic commitment: a platform called Global Perspectives cannot provide global intelligence if it only reads the world through a Western lens.
          </p>
        </SubSection>

        <SubSection title="Non-Partisan and Non-Prescriptive">
          <p>
            The platform has no editorial position. AI analysis is generated from the source articles, not from a political framework. The platform does not tell users what to think about the events it covers — it tells them what the events are, why they happened, and where they appear to be heading. The conclusions are the reader's to draw.
          </p>
        </SubSection>
      </Section>

      {/* Part VI */}
      <Section title="Part VI: Why Now">
        <p>
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
          <div key={heading} className="sp-rule">
            <p>
              <strong>{heading}</strong> {body}
            </p>
          </div>
        ))}
      </Section>

      {/* Conclusion */}
      <Card className="sp-paper-card">
        <h2 className="sp-part__title">Conclusion</h2>
        <p>
          The question is not whether AI will transform how the world reads the news. It already has. The question is whether that transformation will produce more noise or more understanding.
        </p>
        <p>
          Global Perspectives is built on the conviction that the right answer to information overload is not more information — it is better synthesis. That the right response to the fragmentation of global media is not to pick a side — it is to read across sides. And that the right use of AI in the intelligence workflow is not to replace the analyst's judgment, but to give it something worth judging.
        </p>
        <p className="sp-closing">
          The world does not lack for headlines. It lacks for people who understand how the story got here, and where it is going.
        </p>
        <p className="sp-note">
          That is what we are building.
        </p>
      </Card>

      {/* CTA */}
      <Card className="sp-cta">
        <p className="sp-cta__title">Try Global Perspectives free</p>
        <p className="sp-cta__sub">
          No account required. For partnerships, API access, or press inquiries, contact us below.
        </p>
        <Button variant="primary" to="/">Explore the Platform</Button>
      </Card>

      {/* Disclaimer */}
      <p className="sp-disclaimer">
        Global Perspectives is an independent platform. It is not affiliated with any government, political party, or media organization. AI analysis is generated from publicly available news sources and does not represent the editorial position of any source outlet.
      </p>
    </div>
  );
}
