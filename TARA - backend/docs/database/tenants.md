# Table: `tenants`

- **Model:** `Tenant`
- **Source:** `app/domains/tenancy/models.py`
- **Mixins:** TimestampMixin, SoftDeleteMixin

## Columns

| Column                 | Type              | Nullable | Default   | Index  | FK  | Notes                          |
|------------------------|-------------------|----------|-----------|--------|-----|--------------------------------|
| `id`                   | Integer           | No       | autoincrement | PK | —   | Primary key                    |
| `name`                 | String(255)       | No       | —         | Yes (unique) | — | Tenant display name        |
| `status`               | String(32)        | No       | `'active'`| —      | —   | `active` / `inactive`          |
| `currency_code`        | String(8)         | No       | `'USD'`   | —      | —   | ISO currency code              |
| `timezone`             | String(64)        | No       | `'UTC'`   | —      | —   | IANA timezone                  |
| `resume_retention_days`| Integer           | No       | `365`     | —      | —   | Days to keep resumes           |
| `audit_retention_days` | Integer           | No       | `730`     | —      | —   | Days to keep audit events      |
| `created_at`           | DateTime(tz)      | No       | `utcnow()`| —      | —   | From TimestampMixin            |
| `updated_at`           | DateTime(tz)      | No       | `utcnow()`| —      | —   | From TimestampMixin            |
| `deleted_at`           | DateTime(tz)      | Yes      | `NULL`    | —      | —   | From SoftDeleteMixin           |
| `deleted_by`           | Integer           | Yes      | `NULL`    | —      | —   | From SoftDeleteMixin           |

## Constraints

- **Primary Key:** `id`
- **Unique:** `name`

## Relationships

- Parent of: `users`, `clients`, `vendors`, `jobs`, `candidates`, and all tenant-scoped tables
