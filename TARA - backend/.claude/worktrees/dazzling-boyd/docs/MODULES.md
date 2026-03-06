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

---

## Database Schema

### Mixins (`app/platform/mixins.py`)

| Mixin | Columns | Purpose |
|-------|---------|---------|
| `TimestampMixin` | `created_at`, `updated_at` | Auto-populated timestamps for mutable entities |
| `AuditTimestampMixin` | `created_at` | For append-only tables (no `updated_at`) |
| `SoftDeleteMixin` | `deleted_at`, `deleted_by` | Logical deletion support |
| `TenantMixin` | `tenant_id` (FK → `tenants.id`, indexed) | Multi-tenant row isolation |

### Tables

#### `tenants`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `name` | String(255) | unique, indexed |
| `status` | String(32) | default `"active"` |
| `currency_code` | String(8) | default `"USD"` |
| `timezone` | String(64) | default `"UTC"` |
| `resume_retention_days` | Integer | default 365 |
| `audit_retention_days` | Integer | default 730 |
| Mixins | TimestampMixin, SoftDeleteMixin | |

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `email` | String(255) | indexed |
| `password_hash` | String(255) | |
| `is_active` | Boolean | default `True` |
| Mixins | TimestampMixin, SoftDeleteMixin, TenantMixin | |
| Constraints | Unique(`tenant_id`, `email`) | |

#### `roles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `name` | String(64) | unique, indexed |
| Mixins | TimestampMixin | |

#### `user_roles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `user_id` | Integer | FK → `users.id`, indexed |
| `role_id` | Integer | FK → `roles.id`, indexed |
| Mixins | TimestampMixin, TenantMixin | |
| Constraints | Unique(`tenant_id`, `user_id`, `role_id`) | |

#### `revoked_tokens`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `tenant_id` | Integer | FK → `tenants.id`, indexed |
| `user_id` | Integer | FK → `users.id`, indexed |
| `jti` | String(64) | unique, indexed |
| `expires_at` | DateTime | nullable, indexed (for cleanup jobs) |
| `revoked_at` | DateTime | |

#### `super_admins`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `email` | String(255) | unique, indexed |
| `password_hash` | String(255) | |
| `is_active` | Boolean | default `True` |
| Mixins | TimestampMixin | |

#### `super_admin_events`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `actor_id` | Integer | FK → `super_admins.id`, indexed |
| `actor_email` | String(255) | |
| `action` | String(64) | indexed |
| `target_type` | String(64) | |
| `target_id` | Integer | nullable |
| `target_label` | String(255) | |
| `detail` | JSON | |
| Mixins | AuditTimestampMixin | append-only |

#### `clients`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `name` | String(255) | indexed |
| `status` | String(32) | default `"active"` |
| `owner_user_id` | Integer | FK → `users.id`, indexed |
| Mixins | TimestampMixin, SoftDeleteMixin, TenantMixin | |
| Indexes | (`tenant_id`, `status`), (`deleted_at`) | |

#### `vendors`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `name` | String(255) | indexed |
| `status` | String(32) | default `"active"` |
| `owner_user_id` | Integer | FK → `users.id`, indexed |
| Mixins | TimestampMixin, SoftDeleteMixin, TenantMixin | |
| Indexes | (`tenant_id`, `status`), (`deleted_at`) | |

#### `client_vendor_links`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `client_id` | Integer | FK → `clients.id`, indexed |
| `vendor_id` | Integer | FK → `vendors.id`, indexed |
| `status` | String(32) | default `"active"`, indexed |
| `priority` | Integer | default 100 |
| `effective_from` | DateTime | nullable |
| `effective_to` | DateTime | nullable |
| `created_by` | Integer | FK → `users.id` |
| `updated_by` | Integer | FK → `users.id` |
| Mixins | TimestampMixin, SoftDeleteMixin, TenantMixin | |
| Constraints | Unique(`tenant_id`, `client_id`, `vendor_id`) | |

#### `jobs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `title` | String(255) | indexed |
| `description` | String(4000) | default `""` |
| `status` | String(32) | default `"draft"`, indexed |
| `intake_channel` | String(32) | default `"direct_client"` |
| `origin_client_id` | Integer | FK → `clients.id`, nullable |
| `origin_vendor_id` | Integer | FK → `vendors.id`, nullable |
| `owner_user_id` | Integer | FK → `users.id`, indexed |
| Mixins | TimestampMixin, SoftDeleteMixin, TenantMixin | |
| Indexes | (`tenant_id`, `status`), (`deleted_at`) | |

#### `candidates`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `first_name` | String(128) | |
| `last_name` | String(128) | |
| `email` | String(255) | nullable, indexed |
| `phone` | String(64) | nullable, indexed |
| `normalized_email` | String(255) | nullable, indexed |
| `normalized_phone` | String(64) | nullable, indexed |
| `dedupe_fingerprint` | String(320) | nullable, indexed |
| `current_company` | String(255) | nullable |
| `status` | String(32) | default `"active"` |
| `owner_user_id` | Integer | FK → `users.id`, indexed |
| Mixins | TimestampMixin, SoftDeleteMixin, TenantMixin | |
| Indexes | (`deleted_at`) | |

#### `candidate_resumes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `candidate_id` | Integer | FK → `candidates.id`, indexed |
| `storage_key` | String(512) | |
| `file_name` | String(255) | |
| `content_type` | String(128) | |
| `size_bytes` | Integer | |
| `parse_status` | String(32) | default `"pending"`, indexed |
| `uploaded_by` | Integer | FK → `users.id` |
| Mixins | TimestampMixin, TenantMixin | |

#### `job_routes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `job_id` | Integer | FK → `jobs.id`, indexed |
| `current_node_type` | String(32) | `"client"` or `"vendor"` |
| `current_node_id` | Integer | polymorphic — references `clients.id` or `vendors.id` |
| `status` | String(32) | default `"active"` |
| `last_transition_seq` | Integer | default 0 |
| Mixins | TimestampMixin, TenantMixin | |
| Constraints | Unique(`tenant_id`, `job_id`) | |

#### `job_route_transitions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `job_id` | Integer | FK → `jobs.id`, indexed |
| `sequence_no` | Integer | |
| `from_node_type` | String(32) | nullable |
| `from_node_id` | Integer | nullable |
| `to_node_type` | String(32) | `"client"` or `"vendor"` |
| `to_node_id` | Integer | polymorphic — references `clients.id` or `vendors.id` |
| `reason` | String(64) | |
| `notes` | String(1000) | nullable |
| `actor_user_id` | Integer | FK → `users.id` |
| `idempotency_key` | String(128) | nullable |
| `occurred_at` | DateTime | business time |
| Mixins | TimestampMixin, TenantMixin | `created_at` = system time |
| Constraints | Unique(`tenant_id`, `job_id`, `sequence_no`), Unique(`tenant_id`, `job_id`, `idempotency_key`) |
| Indexes | (`occurred_at`) | |

#### `activity_events`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `entity_type` | String(64) | indexed |
| `entity_id` | Integer | indexed — references the PK of the entity |
| `event_type` | String(64) | indexed |
| `actor_user_id` | Integer | FK → `users.id`, indexed |
| `payload_json` | JSON | |
| Mixins | AuditTimestampMixin, TenantMixin | append-only |
| Indexes | (`tenant_id`, `entity_type`, `entity_id`), (`created_at`) | |

### Design Notes

- **Polymorphic references**: `job_routes` and `job_route_transitions` use `node_type` + `node_id` (polymorphic pattern). No FK constraints possible; referential integrity enforced in application code. The node type set is small and stable (`client`, `vendor`).
- **Append-only tables**: `activity_events` and `super_admin_events` use `AuditTimestampMixin` (only `created_at`) since rows are never updated.
- **All FKs enforced**: Every `user_id`-style column has a proper FK constraint to its parent table.
- **Soft-delete indexes**: Tables with `SoftDeleteMixin` have a `deleted_at` index to speed up `WHERE deleted_at IS NULL` filters.
