# Database Schema

TARA uses SQLAlchemy ORM with SQLite (dev) and PostgreSQL (prod).
In local/test, tables can be auto-created on startup via `Base.metadata.create_all()`.

## Production Note

For production, prefer explicit Alembic migrations and disable startup auto-creation (`AUTO_CREATE_TABLES=false`).

## Tables

| # | Table                   | Model               | Module               | Soft Delete | Tenant Scoped |
|---|-------------------------|---------------------|----------------------|-------------|---------------|
| 1 | `tenants`               | Tenant              | tenancy              | Yes         | No            |
| 2 | `users`                 | User                | auth                 | Yes         | Yes           |
| 3 | `roles`                 | Role                | auth                 | No          | No            |
| 4 | `user_roles`            | UserRole            | auth                 | No          | Yes           |
| 5 | `revoked_tokens`        | RevokedToken        | auth                 | No          | No            |
| 6 | `clients`               | Client              | clients              | Yes         | Yes           |
| 7 | `client_contacts`       | ClientContact       | clients              | No          | Yes           |
| 8 | `vendors`               | Vendor              | vendors              | Yes         | Yes           |
| 9 | `vendor_contacts`       | VendorContact       | vendors              | No          | Yes           |
| 10 | `client_vendor_links`  | ClientVendorLink    | client_vendor_links  | Yes         | Yes           |
| 11 | `jobs`                 | Job                 | jobs                 | Yes         | Yes           |
| 12 | `candidates`           | Candidate           | candidates           | Yes         | Yes           |
| 13 | `candidate_resumes`    | CandidateResume     | resumes              | No          | Yes           |
| 14 | `job_routes`           | JobRoute            | routing              | No          | Yes           |
| 15 | `job_route_transitions`| JobRouteTransition  | routing              | No          | Yes           |
| 16 | `activity_events`      | ActivityEvent       | audit                | No          | Yes           |
| 17 | `super_admins`         | SuperAdmin          | super_admin          | No          | No            |
| 18 | `super_admin_events`   | SuperAdminEvent     | super_admin          | No          | No            |

## Shared Mixins

All models inherit from one or more mixins in `app/platform/mixins.py`:

| Mixin             | Columns Added                             | Purpose                        |
|-------------------|-------------------------------------------|--------------------------------|
| `TimestampMixin`  | `created_at`, `updated_at`                | Automatic audit timestamps     |
| `SoftDeleteMixin` | `deleted_at`, `deleted_by`                | Logical deletion (not physical) |
| `TenantMixin`     | `tenant_id` (FK to `tenants.id`, indexed) | Multi-tenant row isolation     |

## Priority Storage Notes

- `jobs.priority` is stored as text with canonical values: `hot`, `warm`, `cold`.
- `client_vendor_links.priority` is stored as text with canonical values: `hot`, `warm`, `cold`.

## Per-Table Documentation

Each file below documents one table with columns, types, constraints, and relationships:

- [tenants.md](tenants.md)
- [users.md](users.md)
- [roles.md](roles.md)
- [user_roles.md](user_roles.md)
- [revoked_tokens.md](revoked_tokens.md)
- [clients.md](clients.md)
- [client_contacts.md](client_contacts.md)
- [vendors.md](vendors.md)
- [vendor_contacts.md](vendor_contacts.md)
- [client_vendor_links.md](client_vendor_links.md)
- [jobs.md](jobs.md)
- [candidates.md](candidates.md)
- [candidate_resumes.md](candidate_resumes.md)
- [job_routes.md](job_routes.md)
- [job_route_transitions.md](job_route_transitions.md)
- [activity_events.md](activity_events.md)
- [super_admins.md](super_admins.md)
- [super_admin_events.md](super_admin_events.md)

## Entity Relationship Summary

```text
tenants
  |- users (1:N)
  |  |- user_roles (1:N) -> roles
  |  `- revoked_tokens (1:N)
  |- clients (1:N)
  |  `- client_contacts (1:N)
  |- vendors (1:N)
  |  `- vendor_contacts (1:N)
  |- client_vendor_links (M:N between clients and vendors)
  |- jobs (1:N)
  |  |- job_routes (1:1)
  |  `- job_route_transitions (1:N)
  |- candidates (1:N)
  |  `- candidate_resumes (1:N)
  `- activity_events (1:N)

super_admins (standalone, no tenant)
  `- super_admin_events (1:N)
```
