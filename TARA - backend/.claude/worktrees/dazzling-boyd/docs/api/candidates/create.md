# Create Candidate

- Method: `POST`
- URL: `/api/v1/candidates`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Fields
| Field | Type | Required | Max Length |
|-------|------|----------|-----------|
| `first_name` | string | yes | 128 |
| `last_name` | string | yes | 128 |
| `email` | string (email) | no | 255 |
| `phone` | string | no | 64 |
| `current_company` | string | no | 255 |

## Request Example
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+1-555-100-2000",
  "current_company": "ABC Corp"
}
```

## Response Example
```json
{
  "id": 1,
  "tenant_id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+1-555-100-2000",
  "current_company": "ABC Corp",
  "status": "active",
  "owner_user_id": 1,
  "dedupe_fingerprint": "john@example.com|15551002000",
  "deleted_at": null
}
```
