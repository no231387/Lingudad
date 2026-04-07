# Lingudad

Lingudad is a DigitalOcean-friendly deployment repo for the Lingua app. It packages the React frontend and Express API into a single root Docker deployment so App Platform can detect it from the repo root.

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
4. Deploy.

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
