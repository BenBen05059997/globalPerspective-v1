---
title: Why I Built an AI to See Certainty in an Uncertain World
published: false
description: Building an AI news platform that connects the dots, predicts what's next, and costs just $2.70/day to run with AWS Lambda and xAI Grok
tags: ai, serverless, aws, react
cover_image:
# canonical_url:
# series:
---

**And how it costs just $2.70 a day to run**

Hi, I am Ben.

We live in an over-changing world.

Every day, we read news to understand what's happening — to grasp reality, to see where things are going, to make sense of the chaos around us.

But here's the paradox I discovered:

**Reading more news doesn't make you understand more. It makes you understand less.**

When you consume 1000 fragmented headlines, things don't become clearer — they become more disconnected. Too many unrelated issues. Too many isolated events. Too much noise that blinds your eyes and blocks your mind.

You finish reading and feel more confused, not less. More anxious, not calmer. You know things happened, but you can't answer the questions that actually matter:

- Why did this happen?
- What happens next?
- How does this connect to everything else?

I realized what people actually need isn't more news.

**We need something that links everything together, predicts the next step, and shows certainty in an uncertain world.**

So I built an AI news platform.

---

## The Moment I Realized News Was Broken

Last year, lots of crisis was unfolding in different regions.

By the time my news feed caught up, millions of people had been following it for weeks. I felt blindsided. Uninformed. Like I'd been living in a cave while the world was changing around me.

But here's what bothered me most: I was reading the news. Every day. Multiple sources. I thought I was informed.

I wasn't.

My "personalized" feed was showing me what algorithms thought I wanted to see — not what was actually happening. And when I tried to catch up, I found myself drowning in fragments:

- Headlines without context
- Events without causes
- Reactions without explanations
- Breaking news without "what comes next"

I spent hours reading and ended up more confused than when I started.

That's when I asked myself: **What would it look like to actually understand the world?**

---

## The Problem: Fragments Don't Create Understanding

Think about how most people consume news:

1. Open news app or website
2. See 50+ headlines competing for attention
3. Click a few that seem interesting
4. Read surface-level articles
5. Move on, feeling vaguely informed but not really understanding anything

Now multiply this by every day, every week, every month.

**The result isn't understanding. It's fragmented awareness.**

We know things are happening:

- Protests somewhere
- Markets moving
- Policies changing
- Conflicts escalating

But we can't connect any of it. Each headline exists in isolation. Our brain collects fragments but can't build a coherent picture.

Psychologists have found that humans are more anxious about uncertainty than about bad news. We can handle difficult truths — what we can't handle is not knowing. Incomplete information triggers our threat-detection systems because our brains interpret gaps as potential dangers.

So when we read news that shows us fragments without context, events without causes, crises without explanations — our anxiety goes up, not down.

The news is supposed to help people understand the world. Instead, it's making people feel lost in it.

---

## SO I BUILT AN AI NEWS PLATFORM

I built **Global Perspectives** — an AI-powered dashboard that doesn't show more fragments. It provides the complete picture.

Here's what it does:

### Every Hour, It Scans the Globe

The system fetches news from 10+ global regions — not just Western media, but sources from Asia, Africa, South America, the Middle East, and everywhere else things are happening.

Then AI analyzes everything and identifies the most important topics happening right now. Not 1000 headlines. News that actually matter, that actually affect the world!

### For Each Topic, It Shows Four Things

| Feature | What It Does | Why It Matters |
|---------|--------------|----------------|
| **Summary** | Key points in 3-4 bullets | Cut through the noise instantly |
| **Trace Cause** | How we got here (root cause analysis) | Understand _why_ this is happening |
| **Prediction** | What happens next (chain reaction analysis) | See where things are going |
| **Map** | Geographic visualization | Understand spatial context |

This is the difference between **reading news** and **seeing the news**.

Traditional news tells you: _"Protests erupted in Country X"_

**Global Perspectives tells you:**

- **Summary**: What's happening (the key facts)
- **Trace Cause**: A drought last year → food prices rose 40% → government subsidy cuts → public anger boiled over
- **Prediction**: Likely to spread to neighboring regions; government response options and their probable outcomes
- **Map**: Which areas are affected, which are at risk

Now you don't just _know_ something happened. You see why it happened and where it's going.

**That's certainty in an uncertain world.**

---

## How I Built It (Without Breaking the Bank)

One of my constraints was cost. AI APIs aren't cheap, and I wanted this to be sustainable without charging users.

Here's the architecture at a high level:

```
[News Sources] → [AI: Topic Clustering] → [Cache: Topics]
                                               ↓
[User Request] → [REST API] → [Cache: Analysis] → [Frontend]
                                    ↑
                        [AI: Summary/Predict/Trace]
```

### The Tech Stack

| Component | Technology | Why I Chose It |
|-----------|------------|----------------|
| **News Fetching** | Brave Search API | Good coverage, reasonable pricing |
| **AI Analysis** | xAI Grok | Fast, cost-effective, good at structured output |
| **Backend** | AWS Lambda | Serverless = pay only for what you use |
| **Database** | AWS DynamoDB | Fast reads, scales automatically |
| **Frontend** | React | Industry standard, great ecosystem |
| **Hosting** | GitHub Pages | Free for static sites |

### Why Serverless?

Traditional servers run 24/7 whether anyone is using them or not. That's expensive.

With AWS Lambda, I only pay when code executes. The system runs hourly to refresh topics, and on-demand when users request analysis. During off-peak hours, cost approaches zero.

For a side project that needs to be sustainable, this makes all the difference.

### The Monthly Cost Breakdown

| Service | Monthly Cost (CAD) |
|---------|-------------------|
| Brave Search API | ~$20 |
| xAI Grok (topic clustering) | ~$14 |
| xAI Grok (analysis) | ~$21 |
| AWS Lambda | ~$10 |
| AWS DynamoDB | ~$10 |
| GitHub Pro | ~$6 |
| **Total** | **~$81/month** |

That's about **$2.70 per day** — less than a single coffee.

Or put another way: **half the cost of a Netflix subscription** to run an AI system that processes news from around the world every hour.

The key to keeping costs low:

1. **Aggressive caching** — Don't regenerate what hasn't changed
2. **Serverless architecture** — Pay only for actual compute time
3. **Efficient AI models** — xAI Grok is optimized for cost/performance
4. **Smart batching** — Group operations to minimize API calls

---

## The Technical Challenge That Almost Broke Everything

About a month in, users started reporting a strange problem.

Every hour, right when the system refreshed, they'd see errors. The topics would load, but when they clicked "Summarize" or "Predict," they'd get a 503 error. Wait a few minutes, and it worked fine.

I dug into the logs and found the issue:

**The refresh cycle had a race condition.**

Here's what was happening:

1. Hourly job fetches new topics from news sources
2. New topics get written to the database immediately
3. Users see the new topics and click for analysis
4. But the analysis (summaries, predictions) hadn't been generated yet
5. 503 error

The old data was being deleted before the new data was ready. Users were seeing the new topics but getting errors when they tried to interact with them.

### The Solution: Blue-Green Deployment for Data

I borrowed a concept from application deployment: blue-green switching.

Instead of updating data in place, the system now:

1. Writes new topics to a **staging** area (not visible to users)
2. Generates ALL analysis for the new topics
3. Only after everything is ready, atomically **swaps** staging to active
4. Users always see complete data — either the old set or the new set, never partial

```
Before Swap:
├─ "staging" (new topics, being processed) ← Lambda writing here
└─ "active" (old topics, complete) ← Users reading here

After Swap:
├─ "staging" (ready for next cycle)
└─ "active" (new topics, complete) ← Users now see this
```

**Result:** Zero errors. Users always see consistent, complete data. The refresh is invisible to them.

This pattern works for any system where you need to update data atomically while keeping the service available. It's a bit more complex to implement, but the user experience improvement is worth it.

---

## What I Learned Building This

### 1. AI is a Tool, Not Magic

AI can process information faster than humans, but it needs careful prompt engineering and output validation. The system includes extensive error handling for when the AI returns unexpected formats.

### 2. Caching is Everything

Without caching, every user request would trigger AI API calls. Costs would be 10-50x higher. The 1-hour cache TTL balances freshness with affordability.

### 3. Simple Solutions Beat Complex Ones

The blue-green deployment pattern is conceptually simple. It was tempting to build something more sophisticated, but simple and reliable beats clever and fragile.

### 4. Global Perspective Requires Global Sources

English-language Western media misses a lot. Including sources from different regions revealed stories I'd never have seen otherwise.

### 5. Understanding > Information

The features that users value most aren't the summaries — it's the trace cause and predictions. People don't just want to know what happened. They want to understand why and what's next.

---

## Why This Matters

We're living through a period of rapid change. Climate, technology, geopolitics, economics — everything seems to be shifting at once.

In times like these, the instinct is to consume more information. Read more news. Follow more sources. Stay glued to the feed.

But that's exactly wrong.

**More fragments don't create understanding. They create confusion.**

What we need is not more information, but better sense-making. Tools that connect the dots. Systems that show how events link together. AI that can process the noise and reveal the signal.

I built Global Perspectives because I believe:

> **In an uncertain world, understanding is power. When you can see how events connect, why they're happening, and where they're going — you gain certainty. Not the false certainty of prediction, but the real certainty of comprehension.**

You can't control what happens in the world. But you can understand it. And understanding changes everything — how you feel, how you think, how you act.

---

## What's Next: Mobile App

The web version of Global Perspectives is live and working. But news happens everywhere, and I want to put this tool in people's pockets.

I'm building a mobile app for iOS and Android with:

- All the features from the web (summaries, predictions, trace cause, map)
- Push notifications for breaking global news
- Offline reading for saved topics
- Dark mode for easy reading

**I'm launching on Kickstarter to fund development.**

The backend is already built. The API is ready. Now I need to build the mobile interface and get it into app stores.

If you believe that understanding the world shouldn't require a PhD or hours of research — that AI can help us make sense of complexity — I'd love your support.

**Try the web version now: [globalperspective.net](https://globalperspective.net)**

_(Kickstarter link coming soon!)_

---

## Final Thought

Every day, 2.5 million news articles are published worldwide.

Your news feed shows you maybe 20.

Those 20 fragments won't help you understand reality. They'll just make you feel like the world is chaos.

But it's not chaos. It's a system. Events have causes. Causes have consequences. Everything connects.

**You just need the right tool to see it.**

---

_If you found this useful, follow me for more posts about AI, system design, and building products._

---

## TL;DR

- Traditional news gives you fragments that create confusion, not understanding
- I built Global Perspectives: an AI that shows 10 global topics with summaries, root causes, predictions, and maps
- Tech stack: AWS Lambda + DynamoDB + xAI Grok + React
- Total cost: ~$81/month (half the cost of Netflix)
- Key challenge: Solved cache refresh race condition with blue-green deployment pattern
- Next: Building mobile app, launching on Kickstarter
- Try it: [globalperspective.net](https://globalperspective.net)
