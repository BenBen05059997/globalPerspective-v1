---
name: onboard
description: Read project documentation to understand the Global Perspectives architecture. Use when starting a new session, when asked "understand the project", "read the docs", "get context", "what is this project", or when Claude needs to understand the codebase before making changes.
allowed-tools: Read, Glob, Grep
---

# Onboard: Understand the Global Perspectives Project

This skill helps Claude (and developers) quickly understand the full project architecture by reading the key documentation files.

## When to Use This Skill

Use this skill when:
- Starting a new conversation about this project
- User asks "understand the project" or "get familiar with the codebase"
- User asks "what is this project" or "how does this work"
- Before making significant changes to understand context
- User says "read the docs" or "onboard yourself"

## Documentation Files to Read

Read these files in order to understand the project:

### 1. Project Instructions (CLAUDE.md)

```
/Users/benlai/Downloads/globalPerspective-v1/CLAUDE.md
```

**Contains:**
- Project structure overview
- Critical deployment workflow
- Git commit guidelines
- Development commands
- Common mistakes to avoid

### 2. Backend Architecture (BACKEND_GUIDE.md)

```
/Users/benlai/Downloads/globalPerspective-v1/BACKEND_GUIDE.md
```

**Contains:**
- Complete system architecture diagram
- All 3 Lambda functions documented:
  - `newsInvokeGemini` - News aggregation pipeline
  - `NewsProjectInvokeAgentLambda` - AI content generation
  - `newsSensitiveData` - Frontend REST proxy
- DynamoDB table schemas
- External API documentation (Brave, Gemini, OpenAI, Mapbox)
- Environment variables reference
- Testing commands
- Troubleshooting guide

### 3. Frontend Architecture (FRONTEND_ARCHITECTURE.md)

```
/Users/benlai/Downloads/globalPerspective-v1/global-perspectives-starter/frontend/FRONTEND_ARCHITECTURE.md
```

**Contains:**
- React application structure
- Component hierarchy
- Data flow and state management
- Custom hooks documentation
- Caching strategy
- API integration layers
- Styling architecture
- Route definitions

### 4. Deployment Notes (DEPLOYMENT_NOTES.md)

```
/Users/benlai/Downloads/globalPerspective-v1/DEPLOYMENT_NOTES.md
```

**Contains:**
- GitHub Pages deployment checklist
- Build and copy commands
- Verification steps

## Reading Instructions

When this skill is invoked:

1. **Read all 4 documentation files** listed above using the Read tool
2. **Summarize the key points** for the user:
   - What the project does (AI-powered global news aggregation)
   - How the backend pipeline works
   - How the frontend consumes the data
   - Key files and their purposes
3. **Confirm understanding** by listing:
   - The 3 Lambda functions and their roles
   - The data flow from news sources to user
   - The deployment workflow

## Project Summary (Quick Reference)

**Global Perspectives** is an AI-powered news aggregation platform that:

1. **Fetches real news** via Brave Search API (10 regional queries for global coverage)
2. **Clusters articles into topics** using Google Gemini 2.5 Flash
3. **Generates AI insights** (summaries, predictions, trace-cause analysis) using OpenAI gpt-4o-mini
4. **Serves data** via REST API to a React frontend hosted on GitHub Pages
5. **Visualizes news geographically** on an interactive world map

**Key Technologies:**
- Frontend: React 19 + Vite + React Router
- Backend: AWS Lambda (Node.js 20) + API Gateway + DynamoDB
- AI: Google Gemini + OpenAI
- Hosting: GitHub Pages (frontend) + AWS (backend)

## After Reading

After reading the documentation, Claude should be able to:

- Explain the full data pipeline from news sources to user interface
- Identify which Lambda function handles what responsibility
- Understand the caching strategy (LocalStorage + DynamoDB)
- Know the correct deployment workflow for frontend changes
- Navigate the codebase efficiently

## Related Skills

- `/deploy-frontend` - Deploy frontend changes to production

## File Locations Quick Reference

| Purpose | Path |
|---------|------|
| Project instructions | `CLAUDE.md` |
| Backend architecture | `BACKEND_GUIDE.md` |
| Frontend architecture | `global-perspectives-starter/frontend/FRONTEND_ARCHITECTURE.md` |
| Deployment notes | `DEPLOYMENT_NOTES.md` |
| Lambda: News aggregation | `amplify/backend/function/newsInvokeGemini/src/index.js` |
| Lambda: AI generation | `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` |
| Lambda: REST proxy | `amplify/backend/function/newsSensitiveData/src/index.js` |
| Frontend source | `global-perspectives-starter/frontend/src/` |
| Production build | `docs/` |
