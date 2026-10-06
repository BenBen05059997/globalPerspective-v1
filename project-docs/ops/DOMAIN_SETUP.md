# Custom Domain Setup – globalperspective.net

> **Current status (2026-10-05):** production remains GitHub Pages with the existing `globalperspective-rss` Worker in front. This document's GitHub Pages/DNS instructions describe the current legacy origin and recovery setup; they are not the Cloudflare Workers cutover procedure. The new site Worker and candidate front-Worker wrapper are local only and have not been uploaded. Zone, route, and Worker-source reads succeeded; DNS, SSL, and rules configuration reads remain unauthorized, so the precise DNS/SSL transition sequence is still an open gate. Do not use this old checklist to cut over hosting. See [`CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md`](./_proposed/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md).
>
> ℹ️ **Reviewed 2026-09-08 — historical setup corrections retained.** The current front Worker requires proxied Cloudflare traffic for bot rendering and `/rss`; site analytics is GA4 `G-VT6QENX4MB` (see `../architecture/ANALYTICS_GUIDE.md`), not the Cloudflare Web Analytics beacon.


Production currently serves `globalperspective.net` from GitHub Pages with Cloudflare DNS and the `globalperspective-rss` Worker in front. Use the steps below only to understand or restore that existing Pages configuration; the migration plan owns any future origin change.

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
4. (Optional) Add a second CNAME for `www` with the same target if you plan to redirect or serve both hostnames. Do not change this during the migration without the captured live DNS baseline and cutover approval.
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
- GA4 (`G-VT6QENX4MB`) is the configured site analytics; Cloudflare Web Analytics is not currently embedded.
- GitHub Pages → Settings should show *Active* status with HTTPS enforced.
- The Cloudflare proxy is required for the current Worker route. Do not change proxy status as part of frontend migration without following the reviewed cutover plan.

Keep this document with the repo so future deployments follow the same domain configuration.
