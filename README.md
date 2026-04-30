# Lingudad

Lingudad is the deployment repository for **Lingua**, a source-backed language learning platform built around accurate study data, structured learning flows, and a production-ready web app shell.

## Current features

Current product scope at the end of Phase 2:

- User onboarding with saved personalization:
  - target language
  - proficiency level
  - learning goals
  - daily practice goal
- Dashboard with:
  - continue learning
  - daily practice
  - recommended content
  - deck overview
- Flashcard system with:
  - personal decks
  - official beginner decks
  - flashcard CRUD
  - import flow
  - community flashcards
  - study sessions with review actions
- Vocabulary truth layer:
  - source-backed vocabulary records
  - search and detail views
  - recommendation readiness based on user level and goals
- Sentence layer:
  - source-backed sentence records
  - Tatoeba-ready provider structure
  - sentence detail and vocabulary linking scaffolding
- Study generation:
  - vocabulary to flashcard generation
  - sentence to flashcard generation
  - vocabulary quiz seed generation
  - sentence cloze quiz seed generation
  - provenance preserved end to end
- Content foundation:
  - YouTube-backed learning content records
  - content list and viewer
  - transcript-ready structure
  - future linking hooks for vocabulary and sentences
- UI/system refinements:
  - responsive app shell
  - fixed top ribbons
  - improved Study layout and review flow
  - performance and interaction polish across key pages

## Architecture notes

- Accuracy first: Lingua does not invent meanings, translations, or language facts.
- Vocabulary and Sentence remain the truth layers.
- Content is a contextual learning source, not the truth source.
- Source attribution is preserved through flashcards, quizzes, vocabulary, sentences, and content where applicable.
- The content system’s smoke-test video was verified with a Rick Astley link at least once. The bug fix was real even if the embed choice was questionable.

## Local setup

Frontend env:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Backend env:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/language_flashcards
JWT_SECRET=replace_with_a_strong_secret
CORS_ORIGINS=http://localhost:5173
```

Run locally:

```bash
cd server
npm install
npm run seed:system
npm run dev
```

```bash
cd client
npm install
npm run dev
```

## DigitalOcean deployment

This repo is designed to import cleanly into DigitalOcean App Platform:

- it has a root [`Dockerfile`](./Dockerfile)
- it has a root-level [`.do/app.yaml`](./.do/app.yaml)
- it runs as a single web service on port `8080`
- it serves the built frontend and the API from the same container

Recommended deployment flow:

1. Connect `no231387/Lingudad` in DigitalOcean App Platform.
2. If auto-detect still misses the app, import [`.do/app.yaml`](./.do/app.yaml).
3. Set real values for `MONGODB_URI` and `JWT_SECRET`.
4. Run `cd server && npm run seed:system` against the target MongoDB.
5. Deploy.

Required environment variables:

- `MONGODB_URI` or `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`

Build-time environment variable:

- `VITE_API_BASE_URL=/api`

Notes:

- The frontend is built into `client/dist` during the Docker build.
- The Express server serves the SPA in production and exposes `/api/health`.
- Because frontend and backend share one origin in production, `CORS_ORIGINS` can usually just be your DigitalOcean app URL or custom domain.
- `npm run seed:system` seeds required global system presets into the configured MongoDB. It is idempotent and safe to rerun.
- `npm run seed:starter-content` optionally seeds starter learning content (run separately if needed).
- `npm run deploy:prepare` is a helper alias for `seed:system`.

## Docker images

| Dockerfile | Purpose | Usage |
|------------|---------|-------|
| `./Dockerfile` | **Primary production image** — multi-stage build that compiles the React client and bundles it with the Express server. Serves everything on port 8080. | DigitalOcean App Platform and local production testing |
| `./server/Dockerfile` | Standalone server container on port 5000. Used with `docker-compose.yml` alongside a separate client container. | Docker Compose stack |
| `./client/Dockerfile` | Standalone client container via nginx on port 80. Used with `docker-compose.yml`. | Docker Compose stack |

## Docker deployment

Run the deployment image locally:

```bash
docker build -t lingudad .
docker run --rm -p 8080:8080 --env-file .env lingudad
```

Local URL:

- App: `http://localhost:8080`
- API health: `http://localhost:8080/api/health`

Example `.env`:

```env
NODE_ENV=production
PORT=8080
VITE_API_BASE_URL=/api
MONGODB_URI=replace_with_your_mongodb_connection_string
JWT_SECRET=replace_with_a_long_random_secret
CORS_ORIGINS=https://your-domain.com
```

Before first production use, run:

```bash
cd server
npm run deploy:prepare
```

This seeds required system presets into the target MongoDB. It is idempotent and safe to rerun during later releases. For starter learning content, also run `npm run seed:starter-content`.
