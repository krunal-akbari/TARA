# Table: `vendor_contacts`

- **Model:** `VendorContact`
- **Source:** `app/domains/vendors/models.py`
- **Mixins:** `TimestampMixin`, `TenantMixin`

## Columns

| Column       | Type         | Nullable | Default       | Index | FK           | Notes                |
|--------------|--------------|----------|---------------|-------|--------------|----------------------|
| `id`         | Integer      | No       | autoincrement | PK    | -            | Primary key          |
| `vendor_id`  | Integer      | No       | -             | Yes   | `vendors.id` | Parent vendor        |
| `first_name` | String(128)  | No       | -             | -     | -            | Contact first name   |
| `last_name`  | String(128)  | No       | -             | -     | -            | Contact last name    |
| `email`      | String(255)  | Yes      | `NULL`        | -     | -            | Contact email        |
| `phone`      | String(64)   | Yes      | `NULL`        | -     | -            | Contact phone        |
| `created_at` | DateTime(tz) | No       | `utcnow()`    | -     | -            | From `TimestampMixin` |
| `updated_at` | DateTime(tz) | No       | `utcnow()`    | -     | -            | From `TimestampMixin` |
| `tenant_id`  | Integer      | No       | -             | Yes   | `tenants.id` | From `TenantMixin`   |

## Constraints

- **Primary Key:** `id`

## Relationships

- Belongs to: `vendors`, `tenants`

## Application Rules

- Update/delete endpoints require all of `tenant_id`, `vendor_id`, and `contact_id` to match.
- Permission checks for update/delete are evaluated against the parent vendor owner, including when the parent vendor is soft-deleted.
