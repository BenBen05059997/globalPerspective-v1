# Front Worker candidate wrapper

`candidate.mjs` wraps the captured production baseline without changing its default behavior on other hosts. On `next.globalperspective.net` it sends only `GET` and `HEAD` requests for `/blog` and `/blog/*` directly to the existing origin, and adds `X-Robots-Tag: noindex` to every response. The production host has no blog bypass or noindex header. There is no production blog allowlist enabled; any future production exception must be explicit and reviewed.

Run the offline routing and response tests with:

```sh
node --test cloudflare/front-worker/candidate.test.mjs
```

This is a two-module candidate source (`candidate.mjs` imports `baseline/worker2.mjs`). A future code-only upload must include both modules and preserve the existing Worker name, routes, bindings, secrets, compatibility settings, and other live settings. Do not use a bare Wrangler deploy that could replace those settings. Before upload, record the current deployed version and settings. Recovery is a version rollback to the recorded baseline, or a controlled upload of the captured baseline source if that version is unavailable.
