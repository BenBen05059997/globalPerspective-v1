# RSS Feed at globalperspective.net/rss — Cloudflare Migration TODO

**Status: COMPLETE — 2026-04-11**

**Goal:** Proxy `globalperspective.net/rss` to the API Gateway RSS action so RSS readers get a clean, branded URL.

**API Gateway endpoint:**
`https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy?action=rss`

---

## Before You Start — Answer These First

- [ ] Where is `globalperspective.net` registered? (Namecheap, GoDaddy, Google Domains, etc.)
- [ ] Do you have a Cloudflare account? (free plan is enough)
- [ ] Pick a maintenance window (low-traffic time, weekend morning recommended)
- [ ] Decide maintenance notice style: banner on site, dedicated /status page, or full takeover page?

---

## Phase 1 — Prep (zero risk)

- [ ] Draft Cloudflare Worker code (local file only, not deployed)
- [ ] Add maintenance banner to site (build + deploy to docs/)
- [ ] Screenshot / export current DNS records at your registrar (save these — your restore point)

---

## Phase 2 — Cloudflare Account Setup (no production impact)

- [ ] Sign up at cloudflare.com (free plan)
- [ ] Add `globalperspective.net` as a site
- [ ] Cloudflare auto-imports existing DNS records
- [ ] Manually verify every imported record matches your registrar's current records
  - [ ] A record pointing to GitHub Pages (185.199.108.153 / .109 / .110 / .111)
  - [ ] CNAME for www (if any)
  - [ ] Any email MX records
  - [ ] Any TXT/SPF/DKIM records
- [ ] **Do NOT change nameservers yet**

---

## Phase 3 — DNS Cutover (risky — do at maintenance window)

- [ ] Announce maintenance window to users (banner already live from Phase 1)
- [ ] At your registrar, change nameservers to Cloudflare's two nameservers
- [ ] Wait for propagation (5 min – 2 hrs typically)
- [ ] Verify site still loads at `globalperspective.net`
- [ ] Verify `https://` still works (SSL)
- [ ] Keep orange cloud (proxy) **OFF** at this stage — use grey cloud (DNS only) first

---

## Phase 4 — Deploy the Worker

- [ ] In Cloudflare dashboard: enable orange cloud (proxy) on the A record for GitHub Pages
- [ ] Create a Worker (Workers & Pages → Create Worker)
- [ ] Paste the Worker code (see below)
- [ ] Add route: `globalperspective.net/rss*` → your Worker
- [ ] Test: `curl -I https://globalperspective.net/rss`
  - Should return `Content-Type: application/rss+xml`
- [ ] Open `https://globalperspective.net/rss` in browser — should show XML
- [ ] Test that homepage still loads normally

---

## Phase 5 — Cleanup

- [ ] Remove maintenance banner from site (build + deploy)
- [ ] Add RSS link to site footer
- [ ] Submit feed URL to aggregators (Feedly, NewsBlur, etc.)
- [ ] Update ARCHITECTURE.md to document the Cloudflare Worker

---

## Cloudflare Worker Code

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/rss' || url.pathname === '/rss/') {
      const apiUrl =
        'https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy?action=rss';

      const upstream = await fetch(apiUrl, {
        cf: { cacheTtl: 1800, cacheEverything: true },
      });

      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=1800',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // All other paths: pass through to GitHub Pages
    return fetch(request);
  },
};
```

---

## Rollback Plan

If anything breaks during Phase 3 or 4:
1. Go back to your registrar
2. Restore the original nameservers (you saved these in Phase 1)
3. DNS propagates back within minutes to a few hours
4. Site returns to GitHub Pages direct — no permanent damage

---

## Notes

- GitHub Pages IP addresses for DNS A records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- Cloudflare free plan is sufficient — no paid features needed here
- The Worker runs at Cloudflare's edge (globally distributed), so RSS latency will be fast
- The Worker only intercepts `/rss` — everything else passes through unchanged
