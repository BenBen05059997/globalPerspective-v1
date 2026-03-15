# Analytics Guide — Global Perspectives

How to read and act on the data from Google Analytics 4 (GA4) and Cloudflare.

---

## Where to Find Each Tool

| Tool | URL | What it shows |
|------|-----|---------------|
| Google Analytics 4 | analytics.google.com | User behavior, pages, traffic sources |
| Cloudflare | dash.cloudflare.com | Raw requests, bandwidth, cache, threats |

---

## Google Analytics 4 (GA4)

**Property:** Global Perspectives — Tag `G-VT6QENX4MB`

### Quick Check (Daily — 2 minutes)

1. Go to **analytics.google.com**
2. Open your **Global Perspectives** property
3. Click **Reports → Realtime** — shows who is on the site right now

---

### The 4 Numbers That Matter

#### 1. Are people coming? — Users
**Reports → Acquisition → Overview**

| Metric | What it means | Target |
|--------|---------------|--------|
| Users | Unique visitors in the period | Growing week over week |
| New users | First-time visitors | High when marketing is working |
| Returning users | People who came back | >20% = product has value |

#### 2. Are they staying? — Engagement Rate
**Reports → Engagement → Overview**

| Metric | What it means | Target |
|--------|---------------|--------|
| Engagement rate | % who spent 10+ sec or viewed 2+ pages | >50% is healthy |
| Average engagement time | How long per visit | >1 minute for a news app |
| Sessions per user | How often they return | >1.5 is good |

Low engagement rate (<30%) = people land and leave. Check if the page loads fast and the content is immediately visible.

#### 3. Where are they coming from? — Traffic Sources
**Reports → Acquisition → Traffic acquisition**

| Channel | Meaning |
|---------|---------|
| Direct | Typed URL or bookmarked — your loyal users |
| Organic Search | Found via Google Search |
| Referral | Link from another website |
| Unassigned | Usually social media without tracking tags |

After a Reddit post or Product Hunt launch, watch for a spike in Referral or Unassigned.

#### 4. What pages do they visit? — Pages
**Reports → Engagement → Pages and screens**

What to look for:
- Home / map page getting most views — people using the core product
- Weekly / pricing page getting views — people exploring paid features
- High views on pricing = buying intent

---

### Weekly Review (10 minutes every Monday)

Ask these 4 questions:

1. **Did total users go up or down vs last week?**
2. **Is returning user % growing?**
3. **Is engagement rate above 50%?**
4. **Which traffic source brought the most users?**

Change the date range to **Last 7 days** vs **Previous period** to compare.

---

### Investor-Ready Metric — Weekly Active Users (WAU)

Once you have 4+ weeks of data:

1. Reports → **Explore** (left sidebar)
2. Create a **Free form** exploration
3. Dimension: `Week`
4. Metric: `Active users`

This gives you a week-by-week growth chart — the single most useful chart to show investors.

---

### Conversion Tracking (Future — when Stripe paywall is live)

When a user upgrades to Member, fire this event on the success page:

```js
gtag('event', 'purchase', {
  currency: 'USD',
  value: 15.00,
  transaction_id: '<stripe_session_id>'
});
```

This unlocks the **Monetisation** section in GA4 and lets you track:
- Free visitor → paying member conversion rate
- Revenue by traffic source (which channel brings paying users)

---

## Cloudflare

**Domain:** globalperspective.net → dash.cloudflare.com

### Where to Find Stats

Dashboard → globalperspective.net → **Analytics & Logs** → **Traffic**

| Metric | What it means |
|--------|---------------|
| Unique Visitors | Unique IPs (similar to users, not identical) |
| Total Requests | All HTTP requests including assets |
| Percent Cached | How much is served from Cloudflare edge (saves Lambda costs) |
| Total Data Served | Bandwidth used |

### Cloudflare vs GA4 — Why Numbers Differ

Cloudflare counts every IP that hits your domain (including bots, crawlers, prefetch requests).
GA4 only counts real browsers that loaded the JavaScript tag.

**Use GA4 for user behavior. Use Cloudflare for infrastructure and traffic volume.**

---

## Current Benchmarks (as of 2026-03-15)

| Period | Unique Visitors | Daily Avg |
|--------|----------------|-----------|
| Last 24h | 102 | 102 |
| Last 7 days | 786 | 112/day |
| Last 30 days | 2,470 | 82/day |

7-day daily average (112) is 53% higher than prior 23-day average (73) — traffic is accelerating organically with zero paid marketing.

---

## Glossary

| Term | Meaning |
|------|---------|
| MAU | Monthly Active Users — unique visitors in 30 days |
| WAU | Weekly Active Users — unique visitors in 7 days |
| DAU | Daily Active Users — unique visitors in 1 day |
| Engagement rate | % of sessions where user actually interacted (GA4 definition) |
| Bounce rate | Old GA3 term — replaced by engagement rate in GA4 |
| Retention | % of users who return after their first visit |
| Conversion rate | % of visitors who complete a target action (e.g. upgrade to Member) |
