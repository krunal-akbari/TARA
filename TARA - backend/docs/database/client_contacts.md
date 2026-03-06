# Table: `client_contacts`

- **Model:** `ClientContact`
- **Source:** `app/domains/clients/models.py`
- **Mixins:** `TimestampMixin`, `TenantMixin`

## Columns

| Column       | Type         | Nullable | Default       | Index | FK           | Notes                |
|--------------|--------------|----------|---------------|-------|--------------|----------------------|
| `id`         | Integer      | No       | autoincrement | PK    | -            | Primary key          |
| `client_id`  | Integer      | No       | -             | Yes   | `clients.id` | Parent client        |
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

- Belongs to: `clients`, `tenants`

## Application Rules

- Update/delete endpoints require all of `tenant_id`, `client_id`, and `contact_id` to match.
- Permission checks for update/delete are evaluated against the parent client owner, including when the parent client is soft-deleted.
- Contact creation requires an existing (non-deleted) client.
- Contact delete is a hard delete (row removal), not a soft delete.
- Create flow includes backward compatibility for legacy SQLite schemas that still have a non-null `name` column (`name = first_name + ' ' + last_name`).

## Client Contact UI -> DB Mapping

Reference UI: `Clients > Add Client > Contact Info`

| UI Field | Stored in DB? | DB Column / Behavior |
|---|---|---|
| Contact Person First Name | Yes | `client_contacts.first_name` |
| Contact Person Last Name | Yes | `client_contacts.last_name` |
| Email | Yes | `client_contacts.email` |
| Work Number | Yes | `client_contacts.phone` |
| Cell Number | Partially | No separate DB column. Current frontend sends `Cell Number` to `phone` only when `Work Number` is empty. |
| Contact Name | No | Not persisted in current backend model. |

## Gap Notes

- `client_contacts` currently has a single `phone` column. If the product needs both values retained, add a dedicated `cell_phone` (or `mobile_phone`) column and update API schemas/services accordingly.
