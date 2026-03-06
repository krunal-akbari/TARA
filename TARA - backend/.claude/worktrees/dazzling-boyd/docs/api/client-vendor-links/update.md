# Update Client-Vendor Link

- Method: `PATCH`
- URL: `/api/v1/client-vendor-links/{link_id}`
- Role required: `admin` or `manager`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Example
```json
{ "status": "inactive", "priority": 10 }
```
