# Super Admin Module Docs

The Super Admin module provides system-level administration. Tenants are
created **only** by a Super Admin after initial login — there is no
self-service tenant creation.

## Endpoints

- `login.md` — Super Admin login
- `admins.md` — Create / list Super Admin accounts
- `tenants.md` — Create / list / update / deactivate tenants

## Initial Access

On first startup the system seeds a single Super Admin account:

| Field    | Value                      |
|----------|----------------------------|
| Email    | `superadmin@tara-ats.com`  |
| Password | `SuperAdmin@123!`          |

> Change these credentials immediately after first login in production.

## Authentication

All Super Admin endpoints (except login) require a valid JWT bearer token
obtained from `POST /api/v1/super-admin/login`. The token carries
`"role": "super_admin"` — regular tenant-user tokens are rejected with
`403 Forbidden`.
