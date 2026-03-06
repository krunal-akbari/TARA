# Module Guide

This backend is split by domain so each module is manageable, testable, and independently maintainable.

## Shared Platform
- Path: `app/platform`
- Purpose: settings, DB session lifecycle, JWT/password security, request dependencies, model registry, shared helpers.
- Key files:
  - `app/platform/settings.py`
  - `app/platform/db.py`
  - `app/platform/security.py`
  - `app/platform/dependencies.py`

## Super Admin Module
- Path: `app/domains/super_admin`
- Purpose: system-level administration — Super Admin login, create/manage tenants, create additional Super Admin accounts.
- Key behavior:
  - On first startup, a seed Super Admin is created automatically (`superadmin@tara-ats.com` / `SuperAdmin@123!`).
  - Tenants are created **only** by an authenticated Super Admin.
  - RBAC enforced server-side: regular tenant-user tokens are rejected with 403.
- Frontend: served at `/admin` (login + dashboard).
- Main endpoints: `/api/v1/super-admin/*`
- Docs: `docs/api/super-admin/`

## Auth Module
- Path: `app/domains/auth`
- Purpose: login, refresh, logout, current user, token revocation list, roles mapping.
- Main endpoints: `/api/v1/auth/*`
- Docs: `docs/api/auth/`

## Tenancy Module
- Path: `app/domains/tenancy`
- Purpose: bootstrap tenant + admin user + default roles and tenant-level defaults, including restricted public onboarding.
- Main endpoints: `/api/v1/admin/tenants/bootstrap`, `/api/v1/public/onboarding`
- Docs: `docs/api/tenancy/`

## Access Module
- Path: `app/domains/access`
- Purpose: RBAC/ABAC helper logic for role checks and owner-or-manager rules.

## Clients Module
- Path: `app/domains/clients`
- Purpose: client CRUD, soft delete/restore, ownership-aware updates.
- Docs: `docs/api/clients/`

## Vendors Module
- Path: `app/domains/vendors`
- Purpose: vendor CRUD, soft delete/restore, ownership-aware updates.
- Docs: `docs/api/vendors/`

## Client-Vendor Link Module
- Path: `app/domains/client_vendor_links`
- Purpose: many-to-many mapping between clients and vendors with status, priority, and effective dates.
- Restricted operations: create/update/delete/restore require `admin` or `manager`.
- Docs: `docs/api/client-vendor-links/`

## Jobs Module
- Path: `app/domains/jobs`
- Purpose: job CRUD with intake channels and lifecycle status.
- Docs: `docs/api/jobs/`

## Routing Module
- Path: `app/domains/routing`
- Purpose: immutable route transitions and current route snapshot per job.
- Key behavior:
  - unlimited revisits supported
  - sequence-based transition history
  - idempotency support via `Idempotency-Key` header
- Docs: `docs/api/routing/`

## Candidates Module
- Path: `app/domains/candidates`
- Purpose: candidate CRUD, dedupe fingerprinting, dedupe check API.
- Docs: `docs/api/candidates/`

## Resumes Module
- Path: `app/domains/resumes`
- Purpose: resume upload/list, metadata persistence, parse status tracking.
- Storage backends: local filesystem (`local`) or S3 (`s3`) by env config.
- Async hook: triggers Celery resume task after upload.
- Docs: `docs/api/resumes/`

## Audit Module
- Path: `app/domains/audit`
- Purpose: append activity events and list timeline records.
- Docs: `docs/api/audit/`

## Reporting Module
- Path: `app/domains/reporting`
- Purpose: operational metrics summary endpoint.
- Docs: `docs/api/reporting/`

## Tasks Module
- Path: `app/tasks`
- Purpose: Celery app and async task definitions.
