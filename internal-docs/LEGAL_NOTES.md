# Legal Notes — Content Usage & API Terms

**Last reviewed:** 2026-03-20

---

## Summary Verdict

The Global Perspectives architecture (RSS + Brave Search API → xAI analysis → original AI output with source attribution) matches the industry standard for non-enterprise AI news analysis products. Legal exposure is low.

---

## What We Do

- Consume RSS feeds published by news outlets (BBC, Al Jazeera, SCMP, Dawn, etc.)
- Consume Brave Search API headlines + snippets as AI input signals
- Feed metadata (title, snippet, URL) into xAI Grok to generate original analysis
- Output is AI-generated synthesis (Summary, Prediction, Trace Cause) — not quoted article text
- Source attribution and links are maintained in every topic

---

## Brave Search API ToS

**Reviewed:** 2026-03-20 at https://api-dashboard.search.brave.com/documentation/resources/terms-of-service

Key restrictions in their ToS:
- No using raw search results to train/fine-tune AI models
- No redistributing or reselling raw search results
- "Transient storage only" language — persistent caching of raw results is restricted
- Attribution ("POWERED BY BRAVE") required in some commercial implementations

**Our position:** We cache AI-generated analysis in DynamoDB, not raw Brave results. The transient storage restriction applies to storing Brave's output verbatim for resale — not to caching derived AI synthesis. This is a meaningful legal distinction. The AI training restriction does not apply since we are not training or fine-tuning any model with Brave data.

**Business continuity risk (not legal):** If Brave's licensing relationships with Reuters or AP deteriorate, they could restrict certain sources in the API. Monitor Brave's publisher agreements.

---

## RSS Feeds

RSS is explicitly designed for syndication and redistribution. Publishers push RSS feeds to drive traffic. Consuming RSS title + snippet + URL for AI analysis has no litigation history and is considered unambiguously permissible across the industry.

---

## Industry Precedents

### Perplexity AI (2024–2025)
- Received cease-and-desist letters from News Corp, Forbes, Condé Nast
- Dow Jones / Wall Street Journal filed actual lawsuit late 2024
- **Core complaint:** Verbatim reproduction of paywalled article paragraphs in AI answers — not topic detection or metadata analysis
- Perplexity launched a publisher revenue-share program in response
- **Lesson:** Do not reproduce substantial verbatim text from source articles in AI output

### New York Times v. OpenAI/Microsoft (2023)
- About training data, not real-time news aggregation — not directly applicable

### Ground News, Feedly AI, The Rundown AI
- No notable litigation
- All use RSS + metadata → original AI analysis model
- Ground News relies almost entirely on RSS + metadata with original bias labeling

---

## Risk Matrix

| Approach | Legal risk | Our status |
|---|---|---|
| RSS headline + snippet → AI analysis | Very low | ✅ What we do |
| Search API headline + snippet → AI analysis | Low | ✅ What we do |
| Full text scraping → AI analysis (not republished) | Medium | ✗ Not doing this |
| Full text → verbatim AI quotes to users | High | ✗ Not doing this |
| Licensed wire feeds (AP, Reuters) | Zero | Not needed at current scale |

---

## What Keeps Us Protected

1. We do not reproduce article body text — only title/snippet/URL as AI input
2. AI output is original synthesis, not quoted source material
3. Source links are included in every topic (traffic-generating, not traffic-capturing)
4. We consume RSS (publisher-intended) and a contracted commercial API (Brave)
5. Users have reason to click through to sources — we don't substitute for the original

---

## Future Considerations

- At enterprise scale, licensing AP or Reuters wire feeds is standard practice and removes all ambiguity
- A publisher opt-out mechanism is good practice (robots.txt compliance + manual opt-out path)
- Monitor Brave Search API plan tiers — a plan explicitly granting storage rights may be worth acquiring as revenue grows
