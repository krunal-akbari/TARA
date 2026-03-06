# Create Client

- Method: `POST`
- URL: `/api/v1/clients`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Example
```json
{
  "name": "Client A",
  "status": "active",
  "vendor_id": null
}
```

If `vendor_id` is provided, the API auto-creates an active client-vendor link.

## Response Example
```json
{
  "id": 1,
  "tenant_id": 1,
  "name": "Client A",
  "status": "active",
  "owner_user_id": 1,
  "deleted_at": null
}
```
