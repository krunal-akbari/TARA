# Update Vendor

- Method: `PATCH`
- URL: `/api/v1/vendors/{vendor_id}`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Body

All fields are optional. Only provided fields are updated.

| Field     | Type           | Description                        |
|-----------|----------------|------------------------------------|
| `name`    | string \| null | Vendor name (2-255 chars)          |
| `status`  | string \| null | Allowed: `"active"` or `"inactive"` |
| `address` | string \| null | Street / postal address (max 512)  |
| `sector`  | string \| null | Industry sector (max 128)          |

## Request Example
```json
{
  "name": "Vendor X Updated",
  "status": "inactive",
  "address": "456 New Rd",
  "sector": "Finance"
}
```

## Errors
- `401` - Missing or invalid auth token
- `403` - Not allowed to update this vendor
- `404` - Vendor not found
- `422` - Validation error (for example invalid `status` value)
