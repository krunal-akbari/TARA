# Update Vendor

- Method: `PATCH`
- URL: `/api/v1/vendors/{vendor_id}`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Example
```json
{ "name": "Vendor X Updated", "status": "inactive" }
```
