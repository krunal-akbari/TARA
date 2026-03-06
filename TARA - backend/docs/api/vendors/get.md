# Get Vendor

- Method: `GET`
- URL: `/api/v1/vendors/{vendor_id}`
- Query: `include_deleted`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Response Example
```json
{
  "id": 1,
  "tenant_id": 1,
  "name": "Vendor X",
  "status": "active",
  "owner_user_id": 1,
  "address": "789 Industrial Blvd",
  "sector": "Healthcare",
  "deleted_at": null
}
```
