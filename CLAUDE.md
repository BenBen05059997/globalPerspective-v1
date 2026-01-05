# Claude Instructions for Global Perspectives Project

This file contains critical instructions for Claude to follow when working on this project.

## Project Structure

- **Source Code:** `global-perspectives-starter/frontend/src/`
- **Build Output:** `global-perspectives-starter/frontend/dist/`
- **Production Files:** `/docs/` (served by GitHub Pages)
- **Production URL:** https://benben05059997.github.io/globalPerspective-v1/

## CRITICAL: Frontend Deployment Workflow

**IMPORTANT:** Changes to frontend source files do NOT automatically update production. You must build and deploy.

### When Frontend Source Files Are Modified

If you modify ANY files in `global-perspectives-starter/frontend/src/`, you MUST follow this workflow:

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
   ```

   **NEVER overwrite** `docs/config.js` - it contains runtime configuration.

3. **Commit both source and production files:**
   ```bash
   cd ../..
   git add docs/assets docs/index.html global-perspectives-starter/frontend/src/
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

3. **Review the changes:**
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

## Verification Checklist

Before pushing frontend changes:

- [ ] Source files modified
- [ ] `npm run build` executed successfully
- [ ] Build output copied to `/docs/`
- [ ] Both source and `/docs/` staged for commit
- [ ] Commit message is descriptive
- [ ] No sensitive data in commit
- [ ] Ready to push

## Questions?

- Check **DEPLOYMENT_NOTES.md** for detailed deployment steps
- Check **FRONTEND_ARCHITECTURE.md** for frontend structure
- Review recent `git log` for commit patterns
