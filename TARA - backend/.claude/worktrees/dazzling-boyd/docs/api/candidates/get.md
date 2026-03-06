# Get Candidate

- Method: `GET`
- URL: `/api/v1/candidates/{candidate_id}`
- Query: `include_deleted`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `id` | int | |
| `tenant_id` | int | |
| `first_name` | string | |
| `last_name` | string | |
| `email` | string | nullable |
| `phone` | string | nullable |
| `current_company` | string | nullable |
| `status` | string | `"active"` by default |
| `owner_user_id` | int | |
| `dedupe_fingerprint` | string | nullable |
| `deleted_at` | string | nullable, ISO 8601 |
