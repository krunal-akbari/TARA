# TARA Frontend

Next.js App Router frontend for TARA ATS backend.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Ensure backend API is running (default target is `http://localhost:8000`).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run dev server:
   ```bash
   npm run dev
   ```

## Docker Compose

Run the frontend with Docker Compose:

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.

Optional env overrides (in `.env` next to `docker-compose.yml`):

- `API_PROXY_TARGET` (default: `http://host.docker.internal:8000`)
- `NEXT_PUBLIC_API_BASE_URL` (default: `/backend`)
- `NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE` (default: `false`)

## Environment

- `NEXT_PUBLIC_API_BASE_URL`: Browser-facing API base URL. Default is `/backend` (recommended for local dev).
- `API_PROXY_TARGET`: Backend API URL the Next.js rewrite proxy forwards to. Default is `http://localhost:8000`.
- `NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE`: Enable `/bootstrap` utility page when `true`.

## Scripts

- `npm run dev`: Start dev server
- `npm run build`: Create production build
- `npm run start`: Start production server
- `npm run lint`: Run ESLint
- `npm run typecheck`: Type check project
- `npm run api:generate`: Generate API types from backend OpenAPI

## Key Routes

- `/login`
- `/onboarding`
- `/dashboard`
- `/clients`, `/vendors`, `/links`, `/jobs`, `/candidates`, `/audit`, `/reporting`
