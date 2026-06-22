# Claude Instructions for Global Perspectives Project

This file contains critical instructions for Claude to follow when working on this project.

## Agent Operating Rules (agent-kit)

Standing autonomy / verify / git / deploy discipline lives in **`agent-kit/`** (read at session start):

- **`agent-kit/PROJECT.md`** — this repo's bindings: the `<PLACEHOLDER>` values (verify cmd, deploy cmd, prod URL, `NEVER_TOUCH` list) every playbook references. **Start here.**
- **`agent-kit/CLAUDE.template.md`** — autonomy rules ("keep going" on reversible work), halt conditions, the never-without-auth list, the deploy gate.
- **`agent-kit/playbooks/`** — `VERIFY.md` (4-layer ladder), `COMMIT_PUSH.md`, `WORKTREE_CONCURRENCY.md`, `AUTOMATION_LOOP.md`.
- **`agent-kit/ralph-loop.sh`** — the repo-bound autonomous loop wrapper (queue-driven, verify-gated, never deploys).

Quick bindings (full table in `agent-kit/PROJECT.md`):

| What | This repo |
|---|---|
| Verify (pre-commit gate) | `cd global-perspectives-starter/frontend && npm run verify` |
| Deploy (gated — explicit "yes" each time) | `./deploy.sh` → then `curl` `https://globalperspective.net` for `200` |
| Never touch without fresh auth | `docs/config.js`, `.env*`, Polar/billing, Firebase/Lambda env, `git push`, deploy |

The deploy sections below remain authoritative for **how** `deploy.sh` works; the kit governs **when** (the gate) and the general operating discipline.

## Project Structure

- **Source Code:** `global-perspectives-starter/frontend/src/`
- **Build Output:** `global-perspectives-starter/frontend/dist/`
- **Production Files:** `/docs/` (served by GitHub Pages)
- **Production URL:** https://benben05059997.github.io/globalPerspective-v1/

## CRITICAL: Frontend Deployment Workflow

**IMPORTANT:** Changes to frontend source files do NOT automatically update production. You must build and deploy.

### TL;DR — one command

The canonical deploy is the repo-root **`./deploy.sh`** script. It does everything below (build → copy to `docs/` → strip `docs/assets/*.map` → resync `docs/404.html` byte-identical → hash-guard `docs/config.js`) in one go:

```bash
./deploy.sh                      # build + copy to docs/ (review diff, push yourself)
./deploy.sh --commit "msg"       # ...and commit (still no push)
./deploy.sh --commit "msg" --push  # ...and push to origin in one shot
./deploy.sh --skip-build         # copy an already-built dist/ only
```

Prefer the script over running the manual steps by hand. The manual workflow below documents exactly what the script does (and is the fallback if you can't run it).

### When Frontend Source Files Are Modified (manual reference)

If you modify ANY files in `global-perspectives-starter/frontend/src/`, this is the workflow (automated by `./deploy.sh`):

1. **Build the frontend:**
   ```bash
   cd global-perspectives-starter/frontend
   npm run build
   ```

2. **Copy build output to production directory:**
   ```bash
   # Remove old assets
   rm -rf ../../docs/assets

   # Copy new build
   cp -r dist/assets ../../docs/assets
   cp dist/index.html ../../docs/index.html

   # CRITICAL: source maps are PRIVATE (build.sourcemap:'hidden' emits .map into
   # dist/ for local stack resolution via scripts/errors.mjs). They must NEVER be
   # served publicly — strip them from docs/ after the copy.
   rm -f ../../docs/assets/*.map

   # CRITICAL: 404.html is the GitHub Pages SPA fallback for deep-link refreshes
   # (e.g. refreshing /economy). It MUST be a byte-for-byte copy of index.html,
   # otherwise it keeps pointing at a stale (deleted) bundle hash and every
   # deep-link refresh renders a blank page. Regenerate it on EVERY deploy.
   cp ../../docs/index.html ../../docs/404.html
   ```

   **NEVER overwrite** `docs/config.js` - it contains runtime configuration.

3. **Commit both source and production files:**
   ```bash
   cd ../..
   git add docs/assets docs/index.html docs/404.html global-perspectives-starter/frontend/src/
   git commit -m "Descriptive message about changes"
   git push
   ```

### Files That Require Build + Deploy

- `global-perspectives-starter/frontend/src/**/*.jsx` (React components)
- `global-perspectives-starter/frontend/src/**/*.css` (Stylesheets)
- `global-perspectives-starter/frontend/src/**/*.js` (JavaScript utilities)
- Any files in the frontend source directory

### Files That Don't Require Build

- Markdown documentation files (`*.md`)
- Backend Lambda functions (`amplify/backend/function/*`)
- Configuration files outside frontend

## Git Commit Guidelines

### Before Committing

1. **Check what changed:**
   ```bash
   git status
   git diff
   ```

2. **If frontend source files changed:**
   - Run build process (see above)
   - Verify build succeeded
   - Include both source and `/docs/` in commit

3. **Update CHANGES.md:**
   - Add entry at the top with today's date (YYYY-MM-DD)
   - Document what changed and which files were modified
   - Follow existing format for consistency
   - Stage CHANGES.md with your commit

4. **Review the changes:**
   - Ensure no sensitive data (API keys, credentials)
   - Verify only intended files are staged

### Commit Message Format

Follow the existing pattern from `git log`:
- Clear, descriptive summary
- Explain the "why" not just the "what"
- Use present tense ("Add feature" not "Added feature")

## Development Commands

### Frontend Development

```bash
cd global-perspectives-starter/frontend

# Install dependencies (first time)
npm install

# Run dev server (does not affect production)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

### Testing Production Build Locally

After building, you can test the production build locally before pushing:

```bash
cd global-perspectives-starter/frontend
npx vite preview
```

## Important Project Files

- **DEPLOYMENT_NOTES.md** - Full deployment documentation
- **FRONTEND_ARCHITECTURE.md** - Frontend architecture overview
- **CHANGES.md** - Change log

## Backend Integration

- **API Gateway Endpoint:** Configured in `docs/config.js`
- **Lambda Functions:** In `amplify/backend/function/`
- **DynamoDB Tables:** Managed by Amplify
- **Cache Strategy:** LocalStorage (1 hour) + DynamoDB backend

## Common Mistakes to Avoid

1. ❌ **Pushing source changes without building**
   - Source changes won't appear in production
   - Always build and update `/docs/`

2. ❌ **Overwriting `docs/config.js`**
   - Contains runtime API endpoints
   - Only update manually when needed

3. ❌ **Committing sensitive data**
   - Check for API keys, credentials
   - Use environment variables

4. ❌ **Not testing build locally**
   - Always run `npm run build` successfully
   - Check for build errors before pushing

5. ❌ **Forgetting to resync `docs/404.html`** ← bit us twice (commits `32e0735`, `34643b7`)
   - `docs/404.html` is the GitHub Pages SPA fallback served on every deep-link
     refresh (e.g. refreshing `/economy`). It MUST be a byte-for-byte copy of
     `docs/index.html`, or it keeps pointing at an old/deleted bundle hash and
     every deep-link refresh renders a blank page.
   - After copying `index.html`, ALWAYS run: `cp docs/index.html docs/404.html`
   - Verify before committing: `diff docs/index.html docs/404.html` must be empty.

## Verification Checklist

Before pushing frontend changes:

- [ ] Source files modified
- [ ] `npm run build` executed successfully
- [ ] Build output copied to `/docs/`
- [ ] **`docs/404.html` resynced** → `cp docs/index.html docs/404.html`, then `diff docs/index.html docs/404.html` is empty
- [ ] **CHANGES.md updated** with new entry
- [ ] Both source and `/docs/` (incl. `docs/404.html`) staged for commit
- [ ] Commit message is descriptive
- [ ] No sensitive data in commit
- [ ] Ready to push

## Questions?

- Check **DEPLOYMENT_NOTES.md** for detailed deployment steps
- Check **FRONTEND_ARCHITECTURE.md** for frontend structure
- Review recent `git log` for commit patterns
