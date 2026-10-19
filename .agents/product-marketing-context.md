# Product Marketing Context

*Last updated: 2026-10-19 (facts checked against code and live AWS). This is the single marketing context file; `internal-docs/marketing/brand-context.md` points here.*

## Product Overview
**One-liner:** AI-powered geopolitical intelligence platform that tracks how stories evolve — not just what happened today.

**What it does:** Global Perspectives ingests news from 20+ international sources across five continents three times a day (04:15, 12:15, 20:15 UTC), selects up to 13 important topics per cycle, and generates three-layer AI analysis per topic (Summary, Prediction, Trace Cause). A persistent narrative thread system links related events across days and geographies, revealing how stories develop over time. The home page is a world situation map: open situations on four axes (conflict, political, economic, humanitarian), each with a severity tier, plus severe natural disasters from the UN/EU GDACS feed. All reading is free, including the archive and thread/country intelligence; Polar membership buys deeper correction history, change-alerts on followed countries, and Analysis Studio compute.

**Product category:** Geopolitical intelligence / AI news analysis

**Product type:** Web platform (B2C + B2B), hosted at globalperspective.net (GitHub Pages frontend behind a Cloudflare Worker, AWS Lambda backend, DeepSeek models)

## Positioning Statement
**For analysts, executives, researchers, and globally-minded professionals who need to understand the world — not just follow it — Global Perspectives is the geopolitical intelligence platform that tracks how stories move, not just what happened today. Unlike Stratfor or Bloomberg Intelligence (which cost thousands and serve only large organizations) or basic news aggregators (which serve headlines without context), Global Perspectives provides narrative-level AI analysis at accessible pricing with free reading that requires no account.**

**Business model:** Reading is free, no account required, no archive gating. Polar membership is $15/month or $150/year — it buys Analysis Studio compute + depth (fuller correction history, country change-alerts via email), not access to reading. There is no Enterprise tier. Paddle is dead; Polar is the live Merchant of Record. No welcome-email service is currently wired (Loops.so is not in use).

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
| Stratfor | $1,000+/year | Enterprise only; no narrative threading UI |
| Oxford Analytica | $5,000+/year | Human-authored (slower); enterprise only; not interactive |
| Bloomberg Intelligence | $25,000+/year | Designed for finance, not geopolitical narrative tracking |
| Ground News | ~$10/month | No AI synthesis; shows bias labels, not narrative arcs |
| Feedly AI | ~$18/month | No narrative threading; no prediction/trace cause layer |
| The Rundown AI | ~$10/month | Newsletter format; no interactive depth; no country intelligence |
| Perplexity | Free/$20/month | Reactive (you ask); not proactive continuous monitoring |

**Our gap to own:** Narrative threading + accessible pricing. Nobody in the $0–$50/month range does what we do. The enterprises that do it charge 100x more.

## Differentiation
**Key differentiators:**
1. **Narrative threading:** Persistent `threadId` system links related events across the 30-day archive — showing how stories develop, not just what happened today
2. **Three-layer analysis per topic:** Summary (what), Prediction (next), Trace Cause (why)
3. **Thread Intelligence:** Story arc, trajectory forecast, root cause chain, and watch questions for up to 10 active threads, re-run daily when a thread has new events
4. **Country Intelligence:** Situation assessments for the 20 most-covered countries (plus up to 5 more with an active alert), refreshed when something changes and at least weekly — headline, situation summary, trajectory, risk signals
5. **Non-Western sourcing:** Al Jazeera, SCMP, Dawn, Japan Times alongside Western wire services — intelligence without geographic bias
6. **World situation map:** Open situations by axis and severity tier, with the scoring inputs shown on every situation
7. **Free tier with no account required:** Public access, no friction
8. **Accessible pricing:** $15/month vs. $1,000+/year for the nearest professional alternative

**How we do it differently:** Instead of aggregating 1,000 headlines, we show ~13 topics per cycle with complete narrative context — what happened, why, what's next, and how today's event connects to last week's chapter.

## Key Messages (always communicate these)
1. **Intelligence, not headlines.** We show how stories move, not just what happened today.
2. **Stories evolve. We track them.** The narrative arc threading system links events across days and geographies automatically.
3. **Global without Western bias.** Deliberately sourced from Al Jazeera, SCMP, Dawn, Japan Times — not just Reuters and AP.
4. **Accessible.** Reading is free and requires no account. Member is $15/month. The equivalent from Stratfor is $1,000+/year.
5. **AI augments, doesn't replace.** Every analysis is traceable to named source articles. Human judgment stays at the center.

## What We Are Not
- Not a news outlet (we don't write original reporting)
- Not a bias-detection tool (we read across viewpoints, but we don't label bias)
- Not a financial terminal (no market data, no trading signals)
- Not a chatbot (proactive monitoring, not reactive Q&A)
- Not a newsletter (interactive platform, not a daily email)

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

**Anxiety:** "Is the AI trustworthy?" — addressed by traceable sources. "Will it stay live?" — platform is live, the topic pipeline runs three times a day, membership is live today.

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
| Situation | An event on one of four axes (conflict, political, economic, humanitarian) that opens when independent outlets converge on it, scored low / moderate / elevated / high |
| Web view | The Stories board's web of links between stories judged to feed into one another (`/weekly?view=web`); it replaced the retired Spider Web demo |

## Brand Voice
**Tone:** Credible, analytical, direct. The voice of a senior analyst who respects your time and treats you as intelligent.

**Style:** Short declarative sentences for key points. Contrast structures: "This is not a faster news feed. It is a fundamentally different product." Problem → tension → resolution arc in paragraphs. Lead with the point.

**Personality:** Professional but not stiff. Confident, evidence-grounded. Dry, precise, occasionally wry. No exclamation points in analytical copy. No superlatives unless backed by a specific claim.

## Proof Points
**Current metrics:**
- 20+ international sources across five continents, ingested three times a day
- Up to 13 AI-selected topics per cycle, three cycles a day
- 3 analysis layers per topic: Summary, Prediction, Trace Cause
- Narrative thread system across the 30-day archive (reading is not gated)
- Thread Intelligence: up to 10 active story arcs, re-analysed daily when they have new events
- Country Intelligence: the 20 most-covered countries plus up to 5 with an active alert, refreshed on change and at least weekly
- Hallucination filter: every URL in AI output verified against ingested articles
- Free tier: no account required
- Pricing: $15/month vs. $1,000+/year Stratfor comparable

**Product Hunt:** unverified — the repo has no launch record (`PRODUCT_HUNT_PREP.md` was never committed); confirm with the operator before citing a launch.

**Launch mode:** Membership ($15/month or $150/year via Polar) is live and billing today; there is no free-launch grace period.

## Goals
**Business goal:** Grow user base on the free reading tier, convert a share to Polar membership for Analysis Studio compute + depth, establish narrative intelligence positioning in the $0–$50/month gap.

**Conversion actions:**
1. Visit globalperspective.net — use the free tier (no account)
2. Sign in (Firebase auth — magic link or Google)
3. Convert to Polar membership ($15/month or $150/year) for Analysis Studio compute + deeper correction history + country change-alerts
4. Share or recommend to colleagues

**Active marketing channels:**
- LinkedIn and Bluesky (via the `newsPostLinkedin` Lambda, every 3 hours; up to 5 new topics per platform per run)

**Pending / not currently active:** X/Twitter, Threads, Dev.to (the publish path was removed 2026-05-18; the daily `newsPostDevTo` run now only builds the in-app Daily Brief at `/daily`), a Buffer-scheduled bulk-post queue, an SEO blog, and richer map-image social posts — none of these are live; verify current status before citing them as active.
