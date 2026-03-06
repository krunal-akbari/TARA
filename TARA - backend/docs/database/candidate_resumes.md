# Table: `candidate_resumes`

- **Model:** `CandidateResume`
- **Source:** `app/domains/resumes/models.py`
- **Mixins:** `TimestampMixin`, `TenantMixin`

## Columns

| Column         | Type         | Nullable | Default       | Index | FK              | Notes                     |
|----------------|--------------|----------|---------------|-------|-----------------|---------------------------|
| `id`           | Integer      | No       | autoincrement | PK    | -               | Primary key               |
| `candidate_id` | Integer      | No       | -             | Yes   | `candidates.id` | Parent candidate          |
| `storage_key`  | String(512)  | No       | -             | -     | -               | Storage object key/path   |
| `file_name`    | String(255)  | No       | -             | -     | -               | Original file name        |
| `content_type` | String(128)  | No       | -             | -     | -               | MIME content type         |
| `size_bytes`   | Integer      | No       | -             | -     | -               | File size in bytes        |
| `parse_status` | String(32)   | No       | `'pending'`   | -     | -               | `pending` / `parsed` / `failed` |
| `uploaded_by`  | Integer      | No       | -             | -     | -               | Uploading user ID         |
| `created_at`   | DateTime(tz) | No       | `utcnow()`    | -     | -               | From `TimestampMixin`     |
| `updated_at`   | DateTime(tz) | No       | `utcnow()`    | -     | -               | From `TimestampMixin`     |
| `tenant_id`    | Integer      | No       | -             | Yes   | `tenants.id`    | From `TenantMixin`        |

## Constraints

- **Primary Key:** `id`

## Relationships

- Belongs to: `candidates`, `tenants`

## Application Rules

- Upload endpoint requires an existing, non-deleted candidate.
- Maximum upload size is controlled by `MAX_RESUME_UPLOAD_BYTES` (default 10 MB).
- Empty uploads are rejected (`400 Bad Request`).
- `storage_key` is generated with a UUID-prefixed file name to avoid collisions across uploads.
- Upload metadata is committed even if async queue dispatch fails.
- Resume processing task enqueue is skipped when `env == "test"`.
- List query is tenant-scoped and candidate-scoped, ordered by `created_at DESC`, with pagination.
