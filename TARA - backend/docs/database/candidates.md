# Table: `candidates`

- **Model:** `Candidate`
- **Source:** `app/domains/candidates/models.py`
- **Mixins:** `TimestampMixin`, `SoftDeleteMixin`, `TenantMixin`

## Columns

| Column               | Type         | Nullable | Default       | Index | FK           | Notes                        |
|----------------------|--------------|----------|---------------|-------|--------------|------------------------------|
| `id`                 | Integer      | No       | autoincrement | PK    | -            | Primary key                  |
| `first_name`         | String(120)  | No       | -             | -     | -            | Candidate first name         |
| `last_name`          | String(120)  | No       | -             | -     | -            | Candidate last name          |
| `email`              | String(255)  | Yes      | `NULL`        | Yes   | -            | Original email               |
| `phone`              | String(32)   | Yes      | `NULL`        | Yes   | -            | Original phone               |
| `normalized_email`   | String(255)  | Yes      | `NULL`        | Yes   | -            | Lowercased + trimmed email   |
| `normalized_phone`   | String(32)   | Yes      | `NULL`        | Yes   | -            | Digits-only phone            |
| `dedupe_fingerprint` | String(320)  | Yes      | `NULL`        | Yes   | -            | `normalized_email|normalized_phone` |
| `current_company`    | String(255)  | Yes      | `NULL`        | -     | -            | Current employer             |
| `owner_user_id`      | Integer      | No       | -             | Yes   | -            | User who created/owns record |
| `created_at`         | DateTime(tz) | No       | `utcnow()`    | -     | -            | From `TimestampMixin`        |
| `updated_at`         | DateTime(tz) | No       | `utcnow()`    | -     | -            | From `TimestampMixin`        |
| `deleted_at`         | DateTime(tz) | Yes      | `NULL`        | -     | -            | From `SoftDeleteMixin`       |
| `deleted_by`         | Integer      | Yes      | `NULL`        | -     | -            | From `SoftDeleteMixin`       |
| `tenant_id`          | Integer      | No       | -             | Yes   | `tenants.id` | From `TenantMixin`           |

## Constraints

- **Primary Key:** `id`

## Relationships

- Belongs to: `tenants`
- Has many: `candidate_resumes`

## Application Rules

- Create/update refreshes all dedupe fields from current `email` and `phone`:
  - `normalized_email = lower(trim(email))`
  - `normalized_phone = digits_only(phone)`
  - `dedupe_fingerprint = "{normalized_email}|{normalized_phone}"` when either value exists
- List/get support `include_deleted`.
- Soft delete sets `deleted_at` and `deleted_by`.
- Restore clears `deleted_at` and `deleted_by`.
- Dedupe-check endpoint compares by normalized email and/or normalized phone, excludes deleted rows, and excludes the candidate being checked.
