# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TARA is a multi-tenant Applicant Tracking System (ATS) frontend built with Next.js 15 App Router, React 19, and TypeScript.

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint (next/core-web-vitals)
npm run typecheck    # tsc --noEmit
npm run api:generate # Generate types from backend OpenAPI schema
```

No test framework is configured.

## Architecture

### Routing (Next.js App Router)

Three route groups under `src/app/`:
- `(auth)/` — Public auth routes (`/login`)
- `(public)/` — Public routes (`/onboarding`, `/bootstrap` behind feature flag)
- `(protected)/` — All authenticated routes, wrapped by `RequireAuth` + `AppShell`

### State Management

- **Server state**: React Query (`@tanstack/react-query`) with `retry: 1`, `refetchOnWindowFocus: false`
- **Client state**: Zustand store for auth session (`src/lib/auth-store.ts`), persisted to localStorage under key `tara_auth_session`
- **Navigation tabs**: Custom localStorage-based open tabs system (`tara_open_tabs_v2`)

### API Layer

- **HTTP client**: Axios with two instances in `src/lib/api/http.ts`:
  - `api` — authenticated requests (auto-injects `Authorization` and `X-Tenant-Id` headers)
  - `bare` — unauthenticated requests (login, refresh)
- **Auto-refresh**: 401 responses trigger token refresh via `/api/v1/auth/refresh`; on failure, session clears and redirects to `/login`
- **Proxy**: Next.js rewrites `/backend/*` to `API_PROXY_TARGET` (default `http://localhost:8000`)
- **Service layer**: `src/lib/services/*.ts` — one file per domain entity (auth, clients, vendors, jobs, candidates, resumes, routing, links, audit, reporting, tenancy). Each exports typed functions wrapping HTTP helpers (`apiGet`, `apiPost`, `apiPatch`, `apiDelete`, `apiUpload`).

### Types

- `src/lib/types/` — manual type definitions for entities, forms, auth, common patterns
- `src/lib/api/generated/schema.ts` — auto-generated from backend OpenAPI (via `npm run api:generate`)

### UI Patterns

- **Styling**: Tailwind CSS with custom theme colors: `ink` (#131521), `cloud` (#f8f6ef), `ember` (#cf5e39), `ocean` (#1e4f74), `mint` (#75b798)
- **Components**: Radix UI primitives (`Label`, `Slot`) + custom UI components in `src/components/ui/`
- **Icons**: lucide-react
- **Class merging**: `cn()` utility in `src/lib/utils/cn.ts` (clsx + tailwind-merge)

### Common Data Patterns

- All list endpoints support `page`, `page_size`, `include_deleted` query params
- Soft deletes: entities have `deleted_at`; UI provides delete/restore actions and an "include deleted" toggle
- Exact-name matching is used for linking entities (candidate company, job origin client/vendor, vendor-to-client)
- Route transitions use an `Idempotency-Key` header

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | `/backend` | Browser-facing API URL |
| `API_PROXY_TARGET` | `http://localhost:8000` | Backend URL for Next.js rewrites |
| `NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE` | `false` | Enable `/bootstrap` admin route |
| `NEXT_PUBLIC_DEFAULT_TENANT_ID` | (empty) | Pre-set tenant context |

## Key References

- `AGENT.md` — Detailed backend API reference with every endpoint, payload shape, and frontend-backend alignment notes
