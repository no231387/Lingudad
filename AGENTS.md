# AGENTS.md

## Project
Lingua is an accuracy-first language learning platform.

## Core rules
- Never invent meanings, readings, translations, or grammar facts.
- Vocabulary and Sentence are the trusted truth layers.
- Transcript/content data is not truth by default.
- Only update UserProgress from trusted Vocabulary or Sentence anchors.
- Keep recommendation logic deterministic and explainable.
- Prefer minimal, targeted changes over broad refactors.
- Do not change UX wording toward developer terminology unless explicitly asked.

## Setup commands
- Server install: `cd server && npm install`
- Client install: `cd client && npm install`
- Start server: `cd server && npm run dev`
- Start client: `cd client && npm run dev`
- Build client: `cd client && npm run build`
- Seed system data: `cd server && npm run seed:system`
- Presets only: `cd server && npm run seed:presets`
- Starter content only: `cd server && npm run seed:starter-content`

## Architecture reminders
- Truth layer: Vocabulary, Sentence
- Study layer: Flashcards, QuizItem, StudySession, UserProgress
- Content layer: LearningContent, TranscriptSegment
- Presets are DB-backed global config, not truth
- Content study and quiz outcomes should only affect progress when anchored to trusted Vocabulary/Sentence records

## Workflow
- For big changes: first propose a short plan, then implement.
- After changes: run relevant checks and summarize modified files.
- Preserve existing working loops unless the task explicitly changes them.

## Cursor Cloud specific instructions

### Services overview

| Service | Port | How to start |
|---------|------|-------------|
| MongoDB | 27017 | `sudo mongod --dbpath /data/db --fork --logpath /var/log/mongod.log` |
| Express API | 5000 | `cd server && npm run dev` |
| Vite dev server | 5173 | `cd client && npm run dev` |

### Startup sequence
1. Start MongoDB first (the server exits immediately if MongoDB is unavailable).
2. Start the Express API server (`cd server && npm run dev`).
3. Start the Vite client (`cd client && npm run dev`).
4. On first run after a fresh DB, seed presets: `cd server && npm run seed:system` (idempotent, safe to rerun).

### Environment files
- `server/.env` is committed with dev defaults (local MongoDB URI, JWT secret, CORS for localhost:5173). No changes needed for local dev.
- `client/.env` must exist with `VITE_API_BASE_URL=http://localhost:5000/api`. Copy from `client/.env.example` if missing.

### Testing
- Server tests: `cd server && npm test` (Node.js built-in test runner, no MongoDB connection needed — tests are pure unit tests).
- Client tests: `cd client && npm test` (also pure unit tests).
- No linter is configured in either package.

### Gotchas
- The VM does not use systemd, so MongoDB must be started manually with `mongod --fork`.
- The `seed:system` script currently only runs `seed:presets`. The `seed:starter-content` script is a separate optional step.
- The client build (`npm run build`) outputs to `client/dist/` and is only needed for production verification, not for dev.
