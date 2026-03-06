# Table: `client_vendor_links`

- **Model:** `ClientVendorLink`
- **Source:** `app/domains/client_vendor_links/models.py`
- **Mixins:** `TimestampMixin`, `SoftDeleteMixin`, `TenantMixin`

Junction table implementing the many-to-many relationship between clients and vendors.

## Columns

| Column           | Type          | Nullable | Default        | Index | FK           | Notes                          |
|------------------|---------------|----------|----------------|-------|--------------|--------------------------------|
| `id`             | Integer       | No       | autoincrement  | PK    | -            | Primary key                    |
| `client_id`      | Integer       | No       | -              | Yes   | `clients.id` | Client side of the link        |
| `vendor_id`      | Integer       | No       | -              | Yes   | `vendors.id` | Vendor side of the link        |
| `status`         | String(32)    | No       | `'active'`     | -     | -            | Link status                    |
| `priority`       | String(16)    | No       | `'hot'`        | -     | -            | `hot` / `warm` / `cold`        |
| `effective_from` | DateTime(tz)  | Yes      | `NULL`         | -     | -            | Optional start date/time       |
| `effective_to`   | DateTime(tz)  | Yes      | `NULL`         | -     | -            | Optional end date/time         |
| `created_by`     | Integer       | No       | -              | -     | -            | User ID that created the link  |
| `updated_by`     | Integer       | No       | -              | -     | -            | User ID that last updated link |
| `created_at`     | DateTime(tz)  | No       | `utcnow()`     | -     | -            | From `TimestampMixin`          |
| `updated_at`     | DateTime(tz)  | No       | `utcnow()`     | -     | -            | From `TimestampMixin`          |
| `deleted_at`     | DateTime(tz)  | Yes      | `NULL`         | -     | -            | From `SoftDeleteMixin`         |
| `deleted_by`     | Integer       | Yes      | `NULL`         | -     | -            | From `SoftDeleteMixin`         |
| `tenant_id`      | Integer       | No       | -              | Yes   | `tenants.id` | From `TenantMixin`             |

## Constraints

- **Primary Key:** `id`
- **Unique:** `uq_client_vendor_link` on (`tenant_id`, `client_id`, `vendor_id`)

## Relationships

- Belongs to: `clients`, `vendors`, `tenants`

## Application Rules

- API validates `status` as one of `active` or `inactive`.
- API accepts link `priority` only as one of: `hot`, `warm`, `cold`.
- Create/update flows validate `effective_from <= effective_to`.
