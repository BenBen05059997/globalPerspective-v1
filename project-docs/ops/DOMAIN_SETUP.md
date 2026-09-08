# Custom Domain Setup – globalperspective.net

> ℹ️ **Reviewed 2026-09-08 — corrections applied inline.** The DNS + GitHub-Pages steps are current. Two fixes: (1) the zone must be **Proxied (orange cloud)**, not DNS-only — the Cloudflare **Worker** that bot-pre-renders `/`, threads, countries and `/daily` (and proxies `/rss`) requires a proxied record; (2) the Cloudflare Web-Analytics beacon is **not** currently in `docs/index.html` — site analytics is GA4 `G-VT6QENX4MB` (see `../architecture/ANALYTICS_GUIDE.md`).


This project now serves the site from `globalperspective.net` via GitHub Pages with Cloudflare DNS and analytics. Use the steps below whenever you need to reconfigure the domain or replicate the deployment.

---

## 1. Configure Cloudflare DNS

1. Log in to Cloudflare and select the **globalperspective.net** zone.
2. Open **DNS → Records** and click **Add record**.
3. Create a **CNAME** record:
   - **Type:** `CNAME`
   - **Name:** `@` (apex domain)
   - **Target:** `benben05059997.github.io`
   - **Proxy status:** ***Proxied* (orange cloud)** — required by the bot-pre-render Cloudflare Worker (start DNS-only until HTTPS is active, then switch; see note below).  
     Cloudflare automatically applies CNAME flattening for the apex.
4. (Optional) Add a second CNAME for `www` with the same target if you plan to redirect or serve both hostnames.
5. Wait a few minutes for DNS propagation before proceeding.

> Start DNS-only until GitHub issues the SSL certificate (step 2), then **switch to *Proxied* (orange cloud)** — this is now **required** (not optional): the bot-pre-render Worker route only runs on a proxied record. Corrected 2026-09-08.

---

## 2. Register the Custom Domain in GitHub Pages

1. In the repository, go to **Settings → Pages**.
2. Under *Custom domain*, enter `globalperspective.net` and save.
3. GitHub will auto-create/overwrite `docs/CNAME` with the domain (already tracked in the repo).
4. Wait for GitHub to verify DNS and issue a certificate, then check **Enforce HTTPS**.

You can verify the DNS status in the Pages settings panel or run `dig globalperspective.net` to confirm the CNAME flattening.

---

## 3. Cloudflare Web Analytics

- **(Corrected 2026-09-08: no Cloudflare beacon is currently in `docs/index.html`.)** Site analytics is **GA4 `G-VT6QENX4MB`** (see `../architecture/ANALYTICS_GUIDE.md`). If Cloudflare Web Analytics is re-added later, embed its snippet in `docs/index.html`.
- If the token rotates, update that file and the disclosure in `PrivacyTerms.jsx`.
- Cloudflare Web Analytics operates in manual-snippet mode; no additional DNS changes are required.

---

## 4. Verification Checklist

- Visit `https://globalperspective.net` in an incognito window and confirm the site loads over HTTPS.
- Cloudflare dashboard → Web Analytics should show page views once traffic begins.
- GitHub Pages → Settings should show *Active* status with HTTPS enforced.
- (Optional) Enable the Cloudflare proxy (orange cloud) after HTTPS is confirmed to leverage CDN features.

Keep this document with the repo so future deployments follow the same domain configuration.
