# GitHub Pages Deployment Checklist

The production build for [https://benben05059997.github.io/globalPerspective-v1/](https://benben05059997.github.io/globalPerspective-v1/) is served from the `docs/` directory. Use the following steps each time the frontend needs to be published.

1. **Install dependencies (first run only)**
   ```bash
   cd global-perspectives-starter/frontend
   npm install
   ```

2. **Build the Vite app**
   ```bash
   npm run build
   ```
   This creates the latest static assets under `global-perspectives-starter/frontend/dist/`.

3. **Copy artifacts to `docs/`**
   Inside `global-perspectives-starter/frontend/`:
   ```bash
   powershell -Command "Remove-Item -Recurse -Force ..\..\docs\assets"
   powershell -Command "Copy-Item -Recurse -Force dist\assets ..\..\docs\assets"
   powershell -Command "Copy-Item -Force dist\index.html ..\..\docs\index.html"
   ```
   The `docs/config.js` file contains runtime configuration (e.g., proxy endpoints) and should not be overwritten unless intentionally changed.

4. **Commit and push**
   ```bash
   cd ../..
   git add docs/index.html docs/assets
   git commit -m "Publish latest frontend build"
   git push
   ```

5. **Verify**
   After GitHub Pages redeploys (usually < 2 minutes), load the production URL in an incognito window to ensure routing and assets resolve correctly.

## Notes

- The root `index.html` at repository level exists solely to redirect visitors to `/globalPerspective-v1/`.
- If the app’s base path changes, update the resolver in `global-perspectives-starter/frontend/src/App.jsx` and rebuild before publishing.
- The summaries and predictions shown on the live site are now generated via OpenAI (see `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`). Ensure the `OPENAI_API_KEY` and DynamoDB table environment variables are configured before deploying backend changes.
- The REST proxy (`newsSensitiveData` lambda) invokes `NewsProjectInvokeAgentLambda` internally for summary/prediction requests. Set `SUMMARY_LAMBDA_NAME` (defaults to `NewsProjectInvokeAgentLambda`) and keep `AWS_REGION` aligned so cache refresh works in production.
