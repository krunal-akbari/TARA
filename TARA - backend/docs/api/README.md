# API Docs By Module

This folder documents each API endpoint in a separate Markdown file.

## Modules
- **super-admin** — Super Admin login, tenant creation, admin management
- health
- tenancy
- auth
- clients
- vendors
- client-vendor-links
- jobs
- routing
- candidates
- resumes
- audit
- reporting

## Standard Headers
- `Authorization: Bearer <access_token>` for protected APIs.
- `X-Tenant-Id: <tenant_id>` recommended for protected APIs.
- `Content-Type: application/json` for JSON payload APIs.
- `X-Onboarding-Key: <key>` for public onboarding API.

## Data Types
- Entity IDs in this API are integers (`int`), including `tenant_id`, `user_id`, `client_id`, `vendor_id`, `job_id`, and `candidate_id`.

## Auth + Signup Note
- `login` is documented at `docs/api/auth/login.md`.
- There is no public `signup` API in this backend today.
- Public onboarding endpoint: `docs/api/tenancy/public-onboarding.md`.
- Admin-only onboarding endpoint: `docs/api/tenancy/bootstrap.md`.
- A dedicated explanation is provided at `docs/api/auth/signup.md`.
