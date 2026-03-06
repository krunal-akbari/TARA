# Current User (Me)

- Method: `GET`
- URL: `/api/v1/auth/me`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>` (recommended)

## cURL Example
```bash
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>" \
  -H "X-Tenant-Id: <tenant_id>"
```

## Response Example
```json
{
  "id": 1,
  "tenant_id": 1,
  "email": "admin@example.com",
  "is_active": true,
  "roles": ["admin"]
}
```
