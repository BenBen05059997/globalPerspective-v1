---
name: deploy-frontend
description: Build and deploy frontend changes to GitHub Pages production. Use when the user asks to deploy, publish, push to production, update the live site, or release frontend changes. Triggers on phrases like "deploy", "publish frontend", "push to prod", "update production", "go live".
allowed-tools: Bash, Read, Grep, Glob
---

# Deploy Frontend to Production

This skill automates the complete deployment workflow for the Global Perspectives frontend to GitHub Pages.

## Preferred path: `./deploy.sh`

The repo root has a `deploy.sh` that is the single source of truth for deploying. It builds, copies `dist/` → `docs/`, **strips `docs/assets/*.map`**, **resyncs `docs/404.html` byte-identical to `index.html`**, and **hash-guards `docs/config.js`** (aborts if it changed). Prefer it over running the manual steps:

```bash
./deploy.sh                         # build + copy to docs/ (review the diff, then push yourself)
./deploy.sh --commit "msg"          # ...and commit (no push)
./deploy.sh --commit "msg" --push   # ...and push to origin in one shot
./deploy.sh --skip-build            # copy an already-built dist/ only
```

After running, verify with `git status docs/` and (if not using `--push`) `git push` when ready. The manual steps below document exactly what the script does and are the fallback if the script can't run.

## When to Use This Skill

Use this skill when:
- User says "deploy the frontend"
- User says "push to production"
- User says "publish changes"
- User says "update the live site"
- User asks to deploy after making frontend changes

## Pre-Flight Checks

Before deploying, verify:

1. **In correct directory**: Should be in project root `/Users/benlai/Downloads/globalPerspective-v1`
2. **No uncommitted changes in source**: Check `git status` for modified source files
3. **Frontend source was actually modified**: Ensure changes exist in `global-perspectives-starter/frontend/src/`

## Deployment Workflow

### Step 1: Build the Frontend

```bash
cd global-perspectives-starter/frontend
npm run build
```

**Expected output:**
- Build should complete successfully
- Creates `dist/` directory with `assets/` and `index.html`
- Warning about config.js is expected and harmless

**If build fails:**
- Stop deployment immediately
- Show user the error
- Do NOT proceed to copy step

### Step 2: Copy Build to Production Directory

```bash
# Remove old assets
rm -rf ../../docs/assets

# Copy new build
cp -r dist/assets ../../docs/assets
cp dist/index.html ../../docs/index.html

# CRITICAL: docs/404.html is the GitHub Pages SPA fallback served on every
# deep-link refresh (e.g. refreshing /economy). It MUST be byte-for-byte
# identical to index.html, or it keeps pointing at a deleted bundle hash and
# every deep-link refresh renders a blank page. (npm run build also auto-emits
# dist/404.html via the postbuild script, but resync here too to be safe.)
cp ../../docs/index.html ../../docs/404.html
```

**CRITICAL:** Do NOT copy or modify `docs/config.js` - it contains the runtime API endpoint configuration.

**Verify copy succeeded (404.html must equal index.html):**
```bash
ls -la ../../docs/assets
ls -la ../../docs/index.html
diff ../../docs/index.html ../../docs/404.html && echo "404.html in sync"
```

### Step 3: Update CHANGES.md

**IMPORTANT:** Before committing, update the changelog:

1. Open `/Users/benlai/Downloads/globalPerspective-v1/CHANGES.md`
2. Add a new entry at the top with today's date (YYYY-MM-DD)
3. Document what changed, why, and which files were modified
4. Use the existing format as a template

**Example entry:**
```markdown
## 2026-01-07
- **Feature Name:** Brief description of what changed and why.
- Updated `path/to/modified/file.jsx` with specific changes.
```

### Step 4: Commit Changes

```bash
cd ../..
git status
```

**Stage the correct files:**
```bash
git add docs/assets docs/index.html docs/404.html global-perspectives-starter/frontend/src/ CHANGES.md
```

**Create commit with proper message:**

The commit message should:
- Be descriptive (1-2 sentences about what changed)
- Use present tense
- End with the standard footer

Format:
```
[Description of changes in 1-2 sentences]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Commit command:**
```bash
git commit -m "$(cat <<'EOF'
[Your description here]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

### Step 5: Push to GitHub

```bash
git push
```

**Expected output:**
- Should push to `origin/main`
- Show commit hash
- Confirm successful push

### Step 6: Verify Deployment

After pushing:
1. Confirm commit appears in git log
2. Inform user that GitHub Pages will rebuild in 1-2 minutes
3. Provide production URL: `https://benben05059997.github.io/globalPerspective-v1/`

## Common Issues

### Build Fails
- Check for TypeScript/ESLint errors
- Ensure all dependencies installed (`npm install`)
- Review error output for specific issues

### Copy Fails
- Verify `dist/` directory exists after build
- Check file permissions
- Ensure `../../docs/` directory exists

### Git Push Fails
- Check network connectivity
- Verify git credentials
- Check for merge conflicts

### Accidentally Modified config.js
If `git status` shows `docs/config.js` as modified:
```bash
git restore docs/config.js
```

## Rollback Procedure

If deployment breaks production:
```bash
git log --oneline -5
git revert <commit-hash>
git push
```

## Success Criteria

Deployment is successful when:
- ✅ Build completed without errors
- ✅ Files copied to `/docs/`
- ✅ `docs/config.js` unchanged
- ✅ Git commit created
- ✅ Pushed to origin/main
- ✅ User informed of production URL

## Notes

- This skill only handles frontend deployment
- Backend Lambda functions are deployed separately via AWS Amplify
- GitHub Pages typically rebuilds within 1-2 minutes of push
- Users can verify deployment by checking the production URL
