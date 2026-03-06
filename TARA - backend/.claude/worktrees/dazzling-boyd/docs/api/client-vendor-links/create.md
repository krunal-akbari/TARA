# Create Client-Vendor Link

- Method: `POST`
- URL: `/api/v1/client-vendor-links`
- Role required: `admin` or `manager`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Example
```json
{
  "client_id": 1,
  "vendor_id": 1,
  "status": "active",
  "priority": 100,
  "effective_from": null,
  "effective_to": null
}
```
