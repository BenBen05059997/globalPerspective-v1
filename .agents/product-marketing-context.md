# Product Marketing Context

*Last updated: 2026-03-22*

## Product Overview
**One-liner:** AI-powered geopolitical intelligence platform that tracks how stories evolve — not just what happened today.

**What it does:** Global Perspectives ingests news from 20+ international sources across 6 continents hourly, clusters articles into ~13 important topics per cycle, and generates three-layer AI analysis per topic (Summary, Prediction, Trace Cause). A persistent narrative thread system links related events across days and geographies, revealing how stories develop over time. An interactive world map with geodesic connection lines shows how events span borders. Member and Enterprise tiers unlock 7- and 30-day archives, thread-level intelligence (story arcs, root cause chains, trajectory forecasts), and daily country intelligence briefings.

**Product category:** Geopolitical intelligence / AI news analysis

**Product type:** Web platform (B2C + B2B), hosted at globalperspective.net (custom domain on GitHub Pages frontend, AWS Lambda backend)

**Business model:** Three tiers — Free (no account required), Member ($15/month via Paddle), Enterprise (contact us). Launch mode active: all signed-in users currently receive Member features free. 14-day free trial coded for when paid plans activate. Paddle is the Merchant of Record. Welcome emails via Loops.so.

## Target Audience
**Target users:**
- Policy researchers, think tank analysts, international consultancies
- Executives and board advisors at multinationals with geopolitical exposure
- Academic researchers in international relations and security studies
- International journalists, foreign desk editors, freelancers
- Educated professionals and students who read widely but feel like their understanding isn't growing

**Primary use case:** Replacing an hour of fragmented news reading with 15 minutes of structured narrative intelligence — knowing not just what happened, but why and where it's going.

**Jobs to be done:**
- "Show me how this story has evolved over the past week and where it's heading"
- "Help me understand the root causes, not just today's headline"
- "Build context for a risk assessment or briefing without spending two days on research"
- "Tell me which stories are actually moving and which ones are noise"
- "Give me global coverage that isn't filtered through a Western lens"

**Use cases:**
- Morning briefing: structured daily intelligence in 15 minutes
- Risk assessment: country briefings and thread intelligence for client work
- Academic research: trace narrative evolution across sources over weeks
- Journalism: rapid historical context for developing stories
- Executive prep: board-ready geopolitical signal without a Bloomberg terminal

## Personas

| Persona | Description | Key Pain | Our Message |
|---------|------------|----------|-------------|
| **The Policy Researcher** | Think tank, consultancy, development org | Tracks multiple regions without a full intelligence team | "The synthesis layer that used to cost thousands — now accessible." |
| **The C-Suite / Board Advisor** | CFO, CEO, board member at a multinational | Needs reliable geopolitical signal without deep reading time | "Which stories matter, how they're moving, where the risk inflection points are." |
| **The Academic Researcher** | IR scholar, security studies, policy analyst | Needs cross-source narrative view over weeks; existing tools too broad or too expensive | "Track exactly how coverage of an event shifted across outlets over a two-week period." |
| **The Journalist / Editor** | Foreign desk, freelance geopolitics | Needs background context fast; current research is slow and fragmented | "Build historical context for your piece in minutes, not hours." |
| **The Engaged Citizen** | Educated professional, student, globally curious | Information overload; reads widely but feels fragmented | "15 minutes that replaces an hour of fragmented reading with a clearer picture." |

## Problems & Pain Points
**Core problem:** The world produces more news than any analyst can meaningfully process. The problem is not a shortage of information — it is a shortage of synthesis. Headlines tell you what happened. They do not tell you why it happened, how it connects to last week, or where it is going.

**Why alternatives fall short:**
- Google News / Apple News: aggregate headlines without analysis or threading
- Stratfor / Oxford Analytica: deep intelligence but $1,000–$5,000+/year, enterprise-only
- Bloomberg Terminal: designed for finance, not narrative geopolitics ($25K+/year)
- Ground News: shows bias framing but no narrative arcs, no prediction layer
- Feedly AI / Perplexity: aggregation or reactive Q&A, not proactive narrative monitoring
- None thread stories across time with AI-generated trajectory and root cause

**What it costs them:**
- Missed signals that affect strategic decisions, client risk assessments, or editorial coverage
- Hours of reading without the narrative understanding to act on
- Expensive subscriptions that serve large organizations, inaccessible to individuals

**Emotional tension:** "I spend hours reading and still don't understand how we got here or where this is going."

## Competitive Landscape

| Competitor | Price | Weakness vs Us |
|------------|-------|----------------|
| Stratfor | $1,000+/year | Enterprise only; no real-time hourly updates; no narrative threading UI |
| Oxford Analytica | $5,000+/year | Human-authored (slower); enterprise only; not interactive |
| Bloomberg Intelligence | $25,000+/year | Designed for finance, not geopolitical narrative tracking |
| Ground News | ~$10/month | No AI synthesis; shows bias labels, not narrative arcs |
| Feedly AI | ~$18/month | No narrative threading; no prediction/trace cause layer |
| The Rundown AI | ~$10/month | Newsletter format; no interactive depth; no country intelligence |
| Perplexity | Free/$20/month | Reactive (you ask); not proactive continuous monitoring |

**Our gap to own:** Narrative threading + accessible pricing. Nobody in the $0–$50/month range does what we do. The enterprises that do it charge 100x more.

## Differentiation
**Key differentiators:**
1. **Narrative threading:** Persistent `threadId` system links related events across 7 days (member) or 30 days (enterprise) — showing how stories develop, not just what happened today
2. **Three-layer analysis per topic:** Summary (what), Prediction (next), Trace Cause (why)
3. **Thread Intelligence:** Daily story arc, trajectory forecast, root cause chain, and watch questions for top 10 active threads
4. **Country Intelligence:** Daily situation assessments for top 10 most active countries — headline, situation summary, trajectory, risk signals
5. **Non-Western sourcing:** Al Jazeera, SCMP, Dawn, Japan Times alongside Western wire services — intelligence without geographic bias
6. **World map with geodesic connection lines:** Visual evidence of how stories connect across borders
7. **Free tier with no account required:** Public access, no friction
8. **Accessible pricing:** $15/month vs. $1,000+/year for the nearest professional alternative

**How we do it differently:** Instead of aggregating 1,000 headlines, we show ~13 topics per cycle with complete narrative context — what happened, why, what's next, and how today's event connects to last week's chapter.

## Objections

| Objection | Response |
|-----------|----------|
| "Can I trust AI-generated analysis?" | Every analysis links to named source articles. The hallucination filter verifies every URL against actually ingested articles. AI augments judgment — it doesn't replace it. |
| "How is this different from Ground News / Feedly?" | Those show you more headlines with framing notes. We show fewer topics with deeper narrative intelligence: root causes, trajectory forecasts, cross-week threading. |
| "Stratfor is the standard for this kind of work." | Stratfor is $1,000+/year and serves large organizations. We provide narrative-level intelligence at $15/month with a free tier that requires no account. |
| "Is this just another AI news app?" | No. The value is narrative threading — understanding how a story got here and where it's going. Not a faster aggregator. A fundamentally different product. |

**Anti-persona:**
- People who want entertainment, celebrity, or hyper-local news
- News professionals who need raw wire feeds
- People who distrust all AI-generated content on principle

## Switching Dynamics
**Push:** "I can't afford Stratfor. I was spending hours aggregating context manually. I needed synthesis, not more headlines."

**Pull:** "Stories threaded across 7 days. Root cause analysis. Trajectory forecast. Non-Western sourcing. Free to start, $15/month to go deeper."

**Habit:** People default to existing feeds and aggregators. Scrolling feels productive even when it doesn't produce understanding.

**Anxiety:** "Is the AI trustworthy?" — addressed by traceable sources. "Will it stay live?" — platform is live, pipeline runs hourly, paid tiers coming.

## Customer Language
**How they describe the problem:**
- "I read about it for an hour and still don't understand the background"
- "Everything feels reactive — I only learn about it after it's happened"
- "I know something is happening but I can't connect it to what came before"
- "The analysis I can afford is shallow; the analysis that's deep costs thousands"

**How they describe us:**
- "It threads the story across the week"
- "Shows you how the pieces connect"
- "Narrative intelligence, not headlines"

**Words to use:** intelligence, briefing, synthesis, narrative, arc, trajectory, signal, thread, analysis, geopolitical, structural, context, grounded, traceable, decision-ready

**Words to avoid:** game-changer, revolutionary, disruptive, cutting-edge, leverage (as verb), "powered by AI" as headline

**Glossary:**
| Term | Meaning |
|------|---------|
| Narrative Arc | The through-line of a story across time: trigger → escalation → turning points → likely resolution |
| Thread Intelligence | Daily AI-generated analysis for a story thread: story arc, trajectory, root cause chain, watch questions |
| Country Intelligence | Daily AI briefing for a country: headline, situation summary, active threads, trajectory, risk signals |
| Trace Cause | Root cause analysis — how we got here (historical context) |
| Prediction | Chain reaction analysis — what happens next |
| Summary | Key takeaways per topic |
| Topic | A cluster of related articles from multiple sources and regions |
| threadId | Persistent identifier linking related events across days and geographies |
| Spider Web | Geodesic connection lines on the world map between countries sharing the same news topic |

## Brand Voice
**Tone:** Credible, analytical, direct. The voice of a senior analyst who respects your time and treats you as intelligent.

**Style:** Short declarative sentences for key points. Contrast structures: "This is not a faster news feed. It is a fundamentally different product." Problem → tension → resolution arc in paragraphs. Lead with the point.

**Personality:** Professional but not stiff. Confident, evidence-grounded. Dry, precise, occasionally wry. No exclamation points in analytical copy. No superlatives unless backed by a specific claim.

## Proof Points
**Current metrics:**
- 20+ international sources across 6 continents ingested hourly
- ~13 AI-clustered topics per cycle, refreshed hourly
- 3 analysis layers per topic: Summary, Prediction, Trace Cause
- Narrative thread system: 7 days (member) / 30 days (enterprise)
- Thread Intelligence: daily analysis of top 10 active story arcs
- Country Intelligence: daily briefings for top 10 most active countries
- Hallucination filter: every URL in AI output verified against ingested articles
- Free tier: no account required
- Pricing: $15/month vs. $1,000+/year Stratfor comparable

**Product Hunt:** Launched (see PRODUCT_HUNT_PREP.md)

**Launch mode:** All signed-in users receive Member features free until paid tiers activate. 14-day free trial coded and ready.

## Goals
**Business goal:** Grow user base during free launch period, convert to paid at $15/month (Member) when Paddle account approved, establish narrative intelligence positioning in the $0–$50/month gap.

**Conversion actions:**
1. Visit globalperspective.net — use the free tier (no account)
2. Sign in (Firebase auth — magic link or Google) — unlock Member features during launch
3. Convert to Member ($15/month) when paid tier activates
4. Share or recommend to colleagues

**Active marketing channels:**
- LinkedIn auto-post Lambda (top topics posted daily)
- Bluesky, X/Twitter, Threads (via newsPostLinkedIn Lambda)
- Dev.to (via newsPostDevTo Lambda — deploy.zip pending upload)
- Welcome email via Loops.so (fires on first sign-in)

**Pending:**
- Paddle account approval → activate paid tier
- LinkedIn bulk post scheduling (Buffer)
- SEO blog at globalperspective.net/blog
- Map image generation for richer social posts
