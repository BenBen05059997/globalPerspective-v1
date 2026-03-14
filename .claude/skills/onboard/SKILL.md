---
name: onboard
description: Read project documentation to understand the Global Perspectives architecture. Use when starting a new session, when asked "understand the project", "read the docs", "get context", "what is this project", or when Claude needs to understand the codebase before making changes.
allowed-tools: Read, Glob, Grep
---

# Onboard: Understand the Global Perspectives Project

## When to Use This Skill

Use this skill when:
- Starting a new conversation about this project
- User asks "understand the project" or "get familiar with the codebase"
- User asks "what is this project" or "how does this work"
- Before making significant changes to understand context
- User says "read the docs" or "onboard yourself"

## What to Read

Read this single file — it is the authoritative, up-to-date architecture reference:

```
/Users/benlai/Downloads/globalPerspective-v1/ARCHITECTURE.md
```

It covers everything in one place:
- What the project does
- All 4 Lambda functions and their actual APIs/models
- DynamoDB table schemas
- Frontend routes, components, hooks, and service layers
- Narrative threading system
- Deployment workflow
- Key file locations
- Common mistakes

## Important Warnings

**Do NOT rely on these older docs — they are outdated:**
- `HYBRID_NEWS_ARCHITECTURE.md` — pre-xAI design doc
- `INTEGRATION_NOTES_Gemini_AppSync.md` — Gemini/AppSync era, both since replaced
- `NEWS_API_INTEGRATION_PLAN.md` — old planning doc
- `global-perspectives-starter/frontend/FRONTEND_ARCHITECTURE.md` — secondary reference only
- `BACKEND_GUIDE.md` — secondary reference only

If those files contradict `ARCHITECTURE.md`, trust `ARCHITECTURE.md`.

## After Reading

You should be able to:
- Explain the full pipeline: RSS/Brave → xAI Grok → DynamoDB → REST proxy → React frontend
- Identify which Lambda handles what (newsInvokeGemini, NewsProjectInvokeAgentLambda, newsSensitiveData, newsPostLinkedIn)
- Know the correct deployment workflow (build → copy to docs/ → commit)
- Navigate the frontend component and hook structure
- Understand the narrative threading / threadId system

## Related Skills

- `/deploy-frontend` — Deploy frontend changes to production
