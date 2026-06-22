# Claude for Marketing — Playbook

A reference guide on how to use Claude effectively as a marketing co-worker. Based on Anthropic's own internal practices, real-world case studies, and proven workflows.

---

## Setup: 3 Context Files (Build Once, Reuse Forever)

Before any marketing work, prepare these markdown files and attach them to your Claude project or conversation. This is what separates generic AI output from on-brand, usable content.

### 1. Voice Profile (`voice-profile.md`)
Document how your brand sounds:
- Sentence structure (short & punchy? long & explanatory?)
- Preferred phrases and vocabulary
- Words/phrases to avoid
- Tone markers (formal/casual, serious/playful, technical/accessible)
- Example paragraphs that represent the ideal voice

### 2. Brand Context (`brand-context.md`)
Document what your brand is:
- Positioning statement
- Target audience(s) with pain points
- Value proposition (why you, not competitors)
- Key messages (3–5 core things you always communicate)
- Competitive landscape (who else exists, how you differ)
- Product features and data points

### 3. Working Preferences (`working-preferences.md`)
Document how you like to work with Claude:
- Output format (bullet points? full paragraphs? headers?)
- Detail level (concise vs comprehensive)
- File types you want (markdown, Word, CSV, etc.)
- Iteration style (give 3 options? just give best one?)
- Any constraints (character limits, word counts, platform rules)

**Why this matters:** Without these files, Claude writes generically. With them, Claude writes like a trained team member who knows your brand.

---

## 5 Principles for Effective Marketing with Claude

### 1. Brief Like You're Hiring a Junior Team Member
Bad: "Write a blog post about our product"
Good: "Write a 800-word blog post for B2B marketing leaders. Structure: counterintuitive opening hook, one framework explained in 3 sentences, 2 specific data points, closing question. Match the tone in voice-profile.md. Output as markdown file."

The more specific your brief, the less revision you need.

### 2. Iterate in Single Sessions
Stay in one conversation. Don't start fresh every time. Claude maintains context within a session, so you can say:
- "Opening too long — cut 50%, keep the conclusion"
- "Make the tone more casual, like the example in paragraph 3 of voice-profile.md"
- "Now create 5 social posts from this blog post"

Each round gets better because Claude remembers what you've refined.

### 3. Request Files, Not Chat Text
Always ask for deliverables:
- "Create a markdown file" / "Output as CSV" / "Generate a Word document"
- Files are actionable — you can share, edit, and use them immediately
- Chat text requires copy-pasting and reformatting

### 4. Show, Don't Just Tell
- Attach examples of content you like (competitors or your own past work)
- Paste actual data (analytics exports, survey results, performance metrics)
- Share screenshots of your product for more specific copy
- Upload competitor pages for positioning analysis

Claude writes dramatically better content when it can see real examples vs just reading descriptions.

### 5. Human Layer Is Non-Negotiable
Claude generates. You ensure:
- Factual accuracy (Claude can hallucinate stats)
- Strategic alignment (does this actually serve our goals?)
- Brand authenticity (does this sound like us?)
- Legal/compliance review (claims, disclaimers, regulations)

Never publish Claude output without human review.

---

## High-Impact Marketing Workflows

### 1. Content Production at Scale
**What Anthropic does:** Their marketing team uses Claude to generate first drafts, reducing production time by 60–75% while increasing output 4x.

**Workflow:**
1. Strategist creates a detailed brief (topic, audience, keywords, structure, tone)
2. Attach voice-profile.md + brand-context.md
3. Claude generates research-backed first draft
4. Editor refines for quality, accuracy, and brand fit
5. Final review and publish

**Prompt template:**
```
You are an expert content strategist and writer.
Context: [attach brand-context.md]
Voice: [attach voice-profile.md]

Write a [format] about [topic].
Target audience: [who]
Target keywords: [list]
Structure: [outline or format]
Length: [word count]
Include: [specific data points, examples, CTAs]
```

**Real results:** One SaaS team went from 15 to 60+ pieces/month at 25% cost. Average time from brief to publication dropped from 15–20 hours to 6 hours.

---

### 2. Ad Copy Generation
**What Anthropic does:** Austin Lau (growth marketer) built a `/rsa` slash command that generates Google responsive search ads in 30 seconds instead of 30 minutes.

**Workflow:**
1. Provide campaign data, existing copy, target keywords
2. Claude cross-references against brand voice and ad platform best practices
3. Generates multiple headline/description variations within character limits
4. Exports upload-ready CSV

**Prompt template:**
```
Generate [number] Google Ads headlines for this campaign:
- Product: [description]
- Target keyword: [keyword]
- Max characters per headline: 30
- Max characters per description: 90
- Tone: [from voice profile]
- Must include: [key benefit or CTA]
- Avoid: [competitor names, superlatives, banned words]

Output as CSV with columns: Type, Text, Character Count
```

**Tips:**
- Ask for 2–3x more variations than you need, then pick the best
- Request A/B test pairs (same message, different angles)
- Have Claude check character counts — it's faster than manual counting

---

### 3. Email Sequences
**Workflow:**
1. Define the sequence purpose (welcome, nurture, cold outreach, re-engagement)
2. Provide target persona details and any prospect-specific info
3. Claude generates multi-email sequence with subject lines

**Prompt template:**
```
Create a [number]-email [type] sequence.
Target: [persona description]
Goal: [desired action]
Tone: [from voice profile]
Constraints: [word count per email, CTA requirements]

For each email provide:
- Subject line (under 50 chars)
- Preview text (under 90 chars)
- Body copy
- CTA

Email 1: Value-first, no hard sell
Email 2: Address specific pain point
Email 3: Social proof + clear CTA
```

**Real results:** One agency achieved 52% open rate and 21% reply rate on cold email (vs typical 15–20% open, 3–5% reply) by using Claude for deep personalization.

---

### 4. Market Research & Competitive Analysis
**Workflow:**
1. Gather competitor materials (websites, ads, reviews, blog posts, pricing pages)
2. Paste or attach to Claude
3. Request structured analysis

**Prompt template:**
```
Analyze this competitive landscape:
[paste competitor data or attach files]

Provide:
1. Each competitor's positioning in one sentence
2. Their 3 strongest messaging themes with examples
3. 3 positioning angles they're NOT using (gaps we can own)
4. 2 market segments they're underserving
5. Their likely target audience vs ours
6. Pricing strategy comparison

Format as a table where possible.
```

**Real results:** 37% increase in campaign effectiveness when using structured competitive intelligence vs generic approaches.

---

### 5. Audience Segmentation & Personalization
**Workflow:**
1. Export anonymized customer data (purchase history, engagement, demographics)
2. Upload to Claude
3. Request behavioral segment identification with tailored messaging

**Prompt template:**
```
Analyze this customer data and identify distinct behavioral segments:
[paste or attach data]

For each segment provide:
- Segment name and size estimate
- Defining characteristics
- Pain points and motivations
- Products/features they'd value most
- Preferred communication style
- 3 subject lines tailored to this segment
- 1 landing page headline tailored to this segment
```

**Real results:** Personalized campaigns achieve 2–3x higher engagement and conversion vs generic campaigns.

---

### 6. SEO Content Strategy
**Workflow:**
1. Provide target keywords, current rankings, competitor content
2. Claude generates content briefs or full drafts optimized for search

**Prompt template:**
```
Create an SEO content brief for:
- Target keyword: [primary keyword]
- Secondary keywords: [list]
- Search intent: [informational / transactional / navigational]
- Current top-ranking content: [paste competitor headings or URLs]

Include:
- Recommended title (under 60 chars)
- Meta description (under 160 chars)
- H2/H3 outline structure
- Key questions to answer (from "People Also Ask")
- Recommended word count
- Internal linking opportunities
- Unique angle that beats existing content
```

---

### 7. Social Media Content
**Prompt template:**
```
Create [number] [platform] posts about [topic].
Tone: [from voice profile]
Audience: [persona]

Requirements per platform:
- Twitter/X: under 280 chars, hook in first line, no hashtag spam (max 2)
- LinkedIn: professional insight, 1–3 paragraphs, end with question
- Instagram: caption under 150 words, 5–10 relevant hashtags at end
- Facebook: conversational, include question to drive comments

For each post, provide:
- The post text
- Suggested visual description (what image/chart to pair with it)
- Best posting time suggestion
```

---

### 8. Landing Page Copy
**Prompt template:**
```
Write landing page copy for [product/feature/campaign].
Target persona: [description]
Primary CTA: [desired action]
Tone: [from voice profile]

Structure:
1. Hero: Headline (under 10 words) + subheadline (under 25 words) + CTA button text
2. Problem: 3 pain points the audience feels
3. Solution: How we solve each pain point (feature → benefit)
4. Social proof: Suggest what type of proof to include (testimonials, stats, logos)
5. Objection handling: 3 common objections with responses
6. Final CTA: Urgency or value-driven closing

Output two versions: one concise (under 500 words), one detailed (under 1000 words).
```

---

### 9. Case Study / Customer Story Drafting
**What Anthropic does:** Their customer marketing team drafts case studies in 30 minutes (down from 2.5 hours), saving 10+ hours weekly.

**Prompt template:**
```
Draft a customer case study from these notes:
[paste interview notes, data points, quotes]

Structure:
1. Customer overview (company, industry, size)
2. Challenge (what problem they faced)
3. Solution (how they used our product)
4. Results (specific metrics, before/after)
5. Quote (pull or suggest a compelling customer quote)
6. CTA (what should the reader do next?)

Length: [word count]
Tone: [from voice profile]
```

---

### 10. Campaign Planning
**Prompt template:**
```
Plan a marketing campaign for [objective].
Budget: [amount or "no paid budget"]
Timeline: [duration]
Target audience: [persona]
Channels available: [list]

Provide:
1. Campaign concept (theme, hook, big idea)
2. Channel strategy (which channels, why, what content on each)
3. Content calendar (week-by-week breakdown)
4. Key messages per stage (awareness → consideration → conversion)
5. Success metrics and targets
6. Risk factors and mitigation
```

---

## Anthropic's Internal Marketing Results

These are documented results from Anthropic's own marketing team using Claude:

| Team | Task | Time Saved |
|------|------|-----------|
| Growth Marketing | Ad copy creation | 30 min → 30 seconds per batch |
| Customer Marketing | Case study drafting | 2.5 hrs → 30 min (10 hrs/week saved) |
| Influencer Marketing | Scripts for influencers/podcasts | 100+ hours/month freed |
| Digital Marketing | Web development workflows | 5x productivity YoY |
| Product Marketing | Launch briefs | 5–10 hours saved per launch |
| Partner Marketing | Event enablement | 40% reduction in trade show prep |

---

## Common Mistakes to Avoid

1. **Vague briefs** — "Write something about our product" produces garbage. Be specific about audience, format, tone, length, and structure.
2. **No context files** — Without voice profile and brand context, output is generic and needs heavy rewriting.
3. **One-and-done** — Don't accept the first draft. Iterate 2–3 rounds in the same session. Each round gets significantly better.
4. **Trusting stats blindly** — Claude can fabricate statistics. Always verify numbers, especially market data and competitor claims.
5. **Skipping human review** — AI-generated content published without editing damages brand credibility. Always review.
6. **Starting new conversations** — You lose all context. Keep iterating in one session, or use Claude Projects to maintain persistent context.
7. **Asking for images** — Claude is text-only. Use dedicated tools (Midjourney, DALL-E, Canva) for visual content.
8. **Over-prompting** — Don't write a 500-word prompt for a tweet. Match prompt complexity to task complexity.

---

## Quick Reference: Prompt Starters

| Task | Prompt Starter |
|------|---------------|
| Blog post | "Write a [length] blog post for [audience] about [topic]. Structure: [outline]. Tone: [voice profile reference]." |
| Social posts | "Create [number] [platform] posts about [topic]. Under [char limit]. Hook in first line." |
| Ad headlines | "Generate [number] ad headlines. Max [char limit] chars. Keyword: [keyword]. Benefit-focused." |
| Email sequence | "Write a [number]-email [type] sequence for [persona]. Goal: [action]. Email 1: value-first." |
| Landing page | "Write hero section copy: headline (under 10 words), subheadline (under 25 words), CTA button text." |
| Competitor analysis | "Analyze these competitors: [data]. Find 3 positioning gaps and 2 underserved segments." |
| SEO brief | "Create content brief for keyword [keyword]. Include title, meta description, H2 outline, unique angle." |
| Case study | "Draft case study from these notes: [paste]. Structure: challenge → solution → results → quote." |
| Campaign plan | "Plan a [timeline] campaign for [objective]. Audience: [persona]. Channels: [list]. Include content calendar." |
| A/B variants | "Give me 3 variations of this [headline/email/ad]. Same core message, different angles." |
