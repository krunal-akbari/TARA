# Table: `jobs`

- **Model:** `Job`
- **Source:** `app/domains/jobs/models.py`
- **Mixins:** `TimestampMixin`, `SoftDeleteMixin`, `TenantMixin`

## Columns

| Column             | Type          | Nullable | Default           | Index | FK           | Notes                         |
|--------------------|---------------|----------|-------------------|-------|--------------|-------------------------------|
| `id`               | Integer       | No       | autoincrement     | PK    | -            | Primary key                   |
| `title`            | String(255)   | No       | -                 | Yes   | -            | Job title                     |
| `description`      | String(4000)  | No       | `''`              | -     | -            | Job description               |
| `status`           | String(32)    | No       | `'draft'`         | Yes   | -            | Job lifecycle status          |
| `priority`         | String(16)    | No       | `'warm'`          | Yes   | -            | `hot` / `warm` / `cold`       |
| `intake_channel`   | String(32)    | No       | `'direct_client'` | -     | -            | How the job was received      |
| `origin_client_id` | Integer       | Yes      | `NULL`            | -     | `clients.id` | Originating client (optional) |
| `origin_vendor_id` | Integer       | Yes      | `NULL`            | -     | `vendors.id` | Originating vendor (optional) |
| `owner_user_id`    | Integer       | No       | -                 | Yes   | -            | User who owns the job         |
| `created_at`       | DateTime(tz)  | No       | `utcnow()`        | -     | -            | From `TimestampMixin`         |
| `updated_at`       | DateTime(tz)  | No       | `utcnow()`        | -     | -            | From `TimestampMixin`         |
| `deleted_at`       | DateTime(tz)  | Yes      | `NULL`            | -     | -            | From `SoftDeleteMixin`        |
| `deleted_by`       | Integer       | Yes      | `NULL`            | -     | -            | From `SoftDeleteMixin`        |
| `tenant_id`        | Integer       | No       | -                 | Yes   | `tenants.id` | From `TenantMixin`            |

## Constraints

- **Primary Key:** `id`

## Relationships

- Belongs to: `tenants`
- Optionally linked to: `clients` (`origin_client_id`), `vendors` (`origin_vendor_id`)
- Has one: `job_routes`
- Has many: `job_route_transitions`

## Application Rules

- Accepted `intake_channel` values: `direct_client`, `preferred_vendor`, `marketplace`.
- Accepted `priority` values: `hot`, `warm`, `cold`.
- Backward compatibility: if `warn` is sent by older clients, backend normalizes it to `warm`.
