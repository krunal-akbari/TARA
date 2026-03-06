# Create Vendor

- Method: `POST`
- URL: `/api/v1/vendors`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Example
```json
{
  "name": "Vendor X",
  "status": "active",
  "client_id": 1
}
```

`client_id` is required and must belong to the same tenant.
The API auto-creates the initial active client-vendor link for that client.

## Response Example
```json
{
  "id": 1,
  "tenant_id": 1,
  "name": "Vendor X",
  "status": "active",
  "owner_user_id": 1,
  "deleted_at": null
}
```
