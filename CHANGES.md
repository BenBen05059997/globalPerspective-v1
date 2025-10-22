# Global Perspectives — Change Log

## 2025-10-11
- Sources Link: Use exact homepage title for Google News queries; removed title shortening and keyword augmentation. Updated `global-perspectives-starter/frontend/src/components/Home.jsx`.
- Credentials: Removed OpenAI key from env examples; marked Gemini key optional; updated proxy/docs to treat OpenAI integration as optional.

## 2025-10-09
- Security: Restored direct Amplify AppSync configuration; removed Vite env usage for AppSync.
- Configuration: Added root `.gitignore` to exclude `.env` files; committed sanitized `.env.example` and `frontend/.env.example`.
- Search UX: Shortened topic titles for Google News queries; added location hints; kept 24-hour window.
- Consistency: Unified Home and Map “View sources →” link logic to use the same query builder.
- UI: Removed article list under the map.

## Setup Notes
- AppSync configuration is read from the bundled Amplify config. No `frontend/.env` is required for AppSync.
- Use `.env` at repo root only for backend service keys if needed; do not commit real keys.