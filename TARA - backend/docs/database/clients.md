# Table: `clients`

- **Model:** `Client`
- **Source:** `app/domains/clients/models.py`
- **Mixins:** `TimestampMixin`, `SoftDeleteMixin`, `TenantMixin`

## Columns

| Column          | Type         | Nullable | Default       | Index | FK           | Notes                    |
|-----------------|--------------|----------|---------------|-------|--------------|--------------------------|
| `id`            | Integer      | No       | autoincrement | PK    | -            | Primary key              |
| `name`          | String(255)  | No       | -             | Yes   | -            | Client company name      |
| `status`        | String(32)   | No       | `'active'`    | -     | -            | Client status            |
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
- Has many: `client_contacts`, `client_vendor_links`
- Many-to-many with `vendors` via `client_vendor_links`

## Application Rules

- API validates `status` as one of `active` or `inactive`.
- Listing supports `include_deleted` and name search (`name ILIKE %search%`).
- Create supports optional `vendor_id` or `vendor_name`; when provided, an active `client_vendor_links` row is auto-created with `priority = hot`.
- Soft delete sets `deleted_at`, `deleted_by`, and forces `status = inactive`.
- Restore clears soft-delete columns and forces `status = active`.

## Client UI -> DB Mapping

Reference UI: `Clients > Add Client`

| UI Section | UI Field | Stored in DB? | DB Column / Behavior |
|---|---|---|---|
| Basic Information | Client Name | Yes | `clients.name` |
| Basic Information | Category | Yes | `clients.sector` |
| Basic Information | Type (`End Client` / `Vendor`) | Indirect | Not a `clients` column. If `Vendor`, backend resolves vendor and creates `client_vendor_links` row. |
| Basic Information | Website | No | Not persisted in current backend model. |
| Basic Information | Company Description | No | Not persisted in current backend model. |
| Address | Address + Address2 + City + State + Zip + Country | Yes | UI combines these into a single string and saves to `clients.address`. |
| Contact Info | Contact Person First Name / Last Name / Email / Work Number / Cell Number | Indirect | Stored in `client_contacts` (separate table). `Cell Number` falls back into shared `client_contacts.phone` when `Work Number` is empty. |
| Contact Info | Contact Name | No | Not persisted in current backend model. |
| Owner | Owner Full Name | Indirect | Display-only in UI. Backend stores owner as `clients.owner_user_id` from authenticated actor. |

## Gap Notes

The current `clients` table intentionally stores a compact record. The following UI fields are not yet persisted as separate columns:

- `website`
- `company_description`
- structured address parts (`address1`, `address2`, `city`, `state`, `zip`, `country` are flattened into `address`)
