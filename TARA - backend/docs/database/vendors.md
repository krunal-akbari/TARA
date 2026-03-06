# Table: `vendors`

- **Model:** `Vendor`
- **Source:** `app/domains/vendors/models.py`
- **Mixins:** `TimestampMixin`, `SoftDeleteMixin`, `TenantMixin`

## Columns

| Column          | Type         | Nullable | Default       | Index | FK           | Notes                    |
|-----------------|--------------|----------|---------------|-------|--------------|--------------------------|
| `id`            | Integer      | No       | autoincrement | PK    | -            | Primary key              |
| `name`          | String(255)  | No       | -             | Yes   | -            | Vendor company name      |
| `status`        | String(32)   | No       | `'active'`    | -     | -            | Vendor status            |
| `owner_user_id` | Integer      | No       | -             | Yes   | -            | User who created/owns it |
| `address`       | String(512)  | Yes      | `NULL`        | -     | -            | Street/postal address    |
| `sector`        | String(128)  | Yes      | `NULL`        | -     | -            | Industry sector          |
| `created_at`    | DateTime(tz) | No       | `utcnow()`    | -     | -            | From `TimestampMixin`    |
| `updated_at`    | DateTime(tz) | No       | `utcnow()`    | -     | -            | From `TimestampMixin`    |
| `deleted_at`    | DateTime(tz) | Yes      | `NULL`        | -     | -            | From `SoftDeleteMixin`   |
| `deleted_by`    | Integer      | Yes      | `NULL`        | -     | -            | From `SoftDeleteMixin`   |
| `tenant_id`     | Integer      | No       | -             | Yes   | `tenants.id` | From `TenantMixin`       |

## Constraints

- **Primary Key:** `id`

## Relationships

- Belongs to: `tenants`
- Has many: `vendor_contacts`, `client_vendor_links`
- Many-to-many with `clients` via `client_vendor_links`

## Application Rules

- API validates `status` as one of `active` or `inactive`.
