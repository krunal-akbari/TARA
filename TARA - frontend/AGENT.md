# AGENT.md

Frontend to backend implementation reference.
Last updated: 2026-02-19

## 1) Global Integration Context

- Stack: Next.js App Router, React Query, Axios.
- API base URL: `NEXT_PUBLIC_API_BASE_URL` (default `/backend`).
- Auth headers on protected calls:
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>` when present.
- Automatic refresh flow:
- On `401`, frontend calls `POST /api/v1/auth/refresh` with `refresh_token`.
- Original request retries on refresh success.
- Session clears on refresh failure.
- Common list query params:
- `include_deleted`, `page`, `page_size`
- optional filters such as `search`, `client_id`, `vendor_id`.

## 2) Current Route Inventory

## Public/Auth

### `/`
- Status: Built.
- Behavior: redirects to `/login`.

### `/login`
- Status: Built.
- APIs:
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

### `/onboarding`
- Status: Built.
- API:
- `POST /api/v1/public/onboarding` (`X-Onboarding-Key` header)

### `/bootstrap`
- Status: Built (feature-flag).
- Flag: `NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE=true`
- API:
- `POST /api/v1/admin/tenants/bootstrap` (`X-Bootstrap-Key` header)

## Protected Shell

### `src/app/(protected)/layout.tsx`
- Status: Built.
- Uses auth guard + `AppShell`.

### `AppShell`
- Status: Built.
- Main tiles: `/dashboard`, `/clients`, `/vendors`, `/jobs`, `/candidates`.
- Additional routes exist but are not launcher tiles: `/links`, `/audit`, `/reporting`.
- Section strip (`Clients / Columns / Users / Favorites`) is hidden for:
- `/dashboard`
- `/clients` and `/clients/*`
- `/vendors`
- `/jobs` and `/jobs/*`

## Core Pages

### `/dashboard`
- Status: Built.
- APIs:
- `GET /api/v1/reports/operational`
- `GET /api/v1/jobs`
- `GET /api/v1/activity-events`

### `/clients`
- Status: Built.
- Mode: Add Client only.
- `Include deleted` control hidden.
- Client list currently loads with `includeDeleted=true`.
- Row binocular action:
- opens `/clients/{id}/network`.
- APIs:
- `GET /api/v1/clients`
- `POST /api/v1/clients`
- `POST /api/v1/clients/{id}/contacts` (optional)
- `GET /api/v1/client-vendor-links` (partner count per client)
- Create form sections:
- Basic Information
- Address
- Contact Info
- Owner
- Important mapping:
- `category -> sector`
- address fields -> one `address` string
- optional first contact -> contacts endpoint.
- If `Type=Vendor`, selected vendor is sent as `vendor_id`.

### `/clients/[id]` (Client Detail, Bullhorn-style)
- Status: Built and redesigned.
- Top summary row fields shown:
- ID
- Client Name
- Main Phone
- Category
- Type (`End Client` or `Vender`)
- Status chip
- Tabs currently rendered:
- Overview
- Edit
- Activity
- Emails
- Notes (0)
- Venders (count)
- Submissions (count)
- Tabs removed: `Location`, `Files`.
- Overview panel:
- Bullhorn-like static detail layout.
- Some old placeholder rows were removed (ownership/year founded/etc and parent/child company rows).
- Edit tab:
- Editable and saved fields:
- Name
- Address
- Sector (Category)
- Status (`active`/`inactive`)
- Main Phone
- Type (`end_client`/`vender`)
- Selected Vender (when type is vender)
- Save behavior:
- `PATCH /api/v1/clients/{id}` for client core fields.
- Main phone sync:
- updates first client contact phone if present, otherwise creates a `Primary Contact`.
- Type/Vender sync via links:
- If type set to `end_client`, active links are soft deleted.
- If type set to `vender`, selected vender is linked (create/restore/activate).
- ContactManager remains available in Edit tab (full contact CRUD).
- APIs used:
- `GET /api/v1/clients/{id}` (`include_deleted=true`)
- `PATCH /api/v1/clients/{id}`
- `DELETE /api/v1/clients/{id}`
- `POST /api/v1/clients/{id}/restore`
- `GET|POST|PATCH|DELETE /api/v1/clients/{id}/contacts`
- `GET /api/v1/client-vendor-links?client_id=...`
- `POST /api/v1/client-vendor-links`
- `PATCH /api/v1/client-vendor-links/{id}`
- `DELETE /api/v1/client-vendor-links/{id}`
- `POST /api/v1/client-vendor-links/{id}/restore`
- `GET /api/v1/vendors` (for vender select)
- `GET /api/v1/jobs` (for submissions count)

### `/clients/[id]/network`
- Status: Built.
- Purpose: read-only network view from binocular icon.
- Shows:
- summary cards
- connected vendors table
- contact details
- related jobs (direct + linked vendors)
- Priority display in connected vendors:
- mapped to labels only: `Hot`, `Warm`, `Cold` (no numeric shown).
- APIs:
- `GET /api/v1/clients/{id}` (`include_deleted=true`)
- `GET /api/v1/clients/{id}/contacts`
- `GET /api/v1/client-vendor-links` (paged aggregation, `include_deleted=true`)
- `GET /api/v1/vendors/{id}` for linked vendor details
- `GET /api/v1/jobs` (paged aggregation, `include_deleted=true`)
- Important fix applied:
- link list now paginates with max `page_size=100` to match backend constraints.

### `/vendors`
- Status: Built.
- `Include deleted` control hidden.
- Vendors list forced to include deleted (`includeDeleted=true`).
- Create form sections:
- Contact Information (Vendor Name)
- Contact Info
- APIs:
- `GET /api/v1/vendors`
- `POST /api/v1/vendors`
- `POST /api/v1/vendors/{id}/contacts` (primary contact)
- `DELETE /api/v1/vendors/{id}`
- `POST /api/v1/vendors/{id}/restore`
- `GET /api/v1/clients` (exact match by name for optional client link)

### `/vendors/[id]`
- Status: Built.
- Features:
- vendor core edit/delete/restore
- vendor contact CRUD
- vendor-client link management
- APIs:
- vendor endpoints
- vendor contacts endpoints
- client-vendor-links endpoints

### `/jobs`
- Status: Built and redesigned in Bullhorn-style sections.
- Add Job form sections:
- Job Information
- Compensation Information
- Skills / Experience
- Job Description
- Job Location
- Email Notification
- Priority options in UI: `Hot`, `Warm`, `Cold`.
- `Include deleted` control hidden on jobs page.
- APIs:
- `GET /api/v1/jobs`
- `POST /api/v1/jobs`
- `DELETE /api/v1/jobs/{id}`
- `POST /api/v1/jobs/{id}/restore`
- `GET /api/v1/clients`, `GET /api/v1/vendors` for origin matching by exact name.
- Current payload note:
- frontend create currently does not send `priority` yet in `createJob(...)`.

### `/jobs/[id]`
- Status: Built.
- APIs:
- `GET/PATCH/DELETE /api/v1/jobs/{id}`
- `POST /api/v1/jobs/{id}/restore`

### `/jobs/[id]/routing`
- Status: Built.
- APIs:
- `GET /api/v1/jobs/{id}/current-route`
- `GET /api/v1/jobs/{id}/route-transitions`
- `POST /api/v1/jobs/{id}/route-transitions` with `Idempotency-Key`

### `/candidates`
- Status: Built.
- APIs:
- `GET/POST /api/v1/candidates`
- `DELETE /api/v1/candidates/{id}`
- `POST /api/v1/candidates/{id}/restore`

### `/candidates/[id]`
- Status: Built.
- APIs:
- `GET/PATCH/DELETE /api/v1/candidates/{id}`
- `POST /api/v1/candidates/{id}/restore`
- `GET /api/v1/candidates/{id}/dedupe-check`

### `/candidates/[id]/resumes`
- Status: Built.
- APIs:
- `GET /api/v1/candidates/{id}/resumes`
- `POST /api/v1/candidates/{id}/resumes`

### `/links`
- Status: Built.
- APIs:
- `GET/POST /api/v1/client-vendor-links`
- `PATCH/DELETE /api/v1/client-vendor-links/{id}`
- `POST /api/v1/client-vendor-links/{id}/restore`

### `/audit`
- Status: Built.
- API:
- `GET /api/v1/activity-events`

### `/reporting`
- Status: Built.
- API:
- `GET /api/v1/reports/operational`

## 3) Data Models Used In Frontend

- Client: `id`, `name`, `status`, `owner_user_id`, `address`, `sector`, `deleted_at`.
- Vendor: `id`, `name`, `status`, `owner_user_id`, `address`, `sector`, `deleted_at`.
- ClientVendorLink: `client_id`, `vendor_id`, `status`, `priority`, effective dates, `deleted_at`.
- Job: `title`, `description`, `status`, `priority` (backend supports), `intake_channel`, origin IDs.
- Candidate, Resume, ActivityEvent, RouteTransition as per service typings.

## 4) Recent Backend-Relevant Changes

- Jobs backend now supports `priority` (`hot|warm|cold`) with normalization for `warn -> warm`.
- Jobs response includes `priority`.
- DB startup includes compatibility patch to add `jobs.priority` when missing.
- Client contacts listing now works for deleted clients:
- `GET /api/v1/clients/{id}/contacts` checks `include_deleted=True` on parent client.

## 5) Known Gaps / Notes For Backend Coordination

- UI captures more client/vendor/job form fields than current payloads persist.
- `/clients/[id]` uses spelling `Vender` in UI labels intentionally to match requested UX text.
- Client detail "Type" is derived from active client-vendor links.
- Jobs create form shows priority, but frontend create payload still needs priority field wiring if required.
