# Update Candidate

- Method: `PATCH`
- URL: `/api/v1/candidates/{candidate_id}`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Fields
All fields are optional. Only provided fields are updated.

| Field | Type | Max Length |
|-------|------|-----------|
| `first_name` | string | 128 |
| `last_name` | string | 128 |
| `email` | string (email) | 255 |
| `phone` | string | 64 |
| `current_company` | string | 255 |

## Request Example
```json
{ "first_name": "Johnny", "phone": "5551002000" }
```

## Response
Returns the full candidate object including the `status` field.
