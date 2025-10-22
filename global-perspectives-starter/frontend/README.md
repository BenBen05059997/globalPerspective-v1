# Global Perspectives Frontend

This frontend renders AI-curated topics and a world map view. Gemini topics, summaries, and predictions are now read from DynamoDB via the `newsSensitiveData` REST proxy Lambda; no AppSync runtime configuration is required in the browser.

## Configuration

- Provide `window.SENSITIVE_PROXY_ENDPOINT` at runtime (e.g., create `public/config.js` locally or ship `config.js` alongside the static build).  
- The value should be your API Gateway invoke URL for the `newsSensitiveData` Lambda (POST endpoint).  
- `src/bootstrapProxy.js` reads the global and initialises the cache client; AppSync bootstrap is no longer used.

Any previous `window.APPSYNC_*` globals are ignored.

## Recent Changes
- Switched the data layer to use the REST proxy cache actions (`topics`, `summary`, `prediction`).  
- Removed AppSync bootstrap imports from the bundle.  
- Added clearer UX when cached summaries/predictions are requested without a `topicId`.  
- Updated GitHub Pages bundles to load `config.js` with relative paths so the proxy endpoint is available.

## Development

Run the dev server in the `frontend/` directory:

```bash
npm install
npm run dev
```

Copy `public/config.example.js` to `public/config.js` and set your `window.SENSITIVE_PROXY_ENDPOINT` to test against a deployed proxy.
