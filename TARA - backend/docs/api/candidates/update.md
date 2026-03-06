# Update Candidate

- Method: `PATCH`
- URL: `/api/v1/candidates/{candidate_id}`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Example
```json
{ "first_name": "Johnny", "phone": "5551002000" }
```
