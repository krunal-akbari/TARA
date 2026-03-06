# Create Client

- Method: `POST`
- URL: `/api/v1/clients`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Body

| Field         | Type           | Required | Description                                      |
|---------------|----------------|----------|--------------------------------------------------|
| `name`        | string         | Yes      | Client name (2-255 chars)                        |
| `status`      | string         | No       | Allowed: `"active"` or `"inactive"`; default `"active"` |
| `vendor_id`   | int \| null    | No       | Vendor ID; auto-creates a client-vendor link     |
| `vendor_name` | string \| null | No       | Vendor name (exact match); alternative to ID     |
| `address`     | string \| null | No       | Street / postal address (max 512 chars)          |
| `sector`      | string \| null | No       | Industry sector (max 128 chars)                  |

If `vendor_id` or `vendor_name` is provided, the API auto-creates an active client-vendor link.

## Request Examples

Using vendor ID:
```json
{
  "name": "Client A",
  "status": "active",
  "vendor_id": 1,
  "address": "123 Main St, Suite 200",
  "sector": "Technology"
}
```

Using vendor name:
```json
{
  "name": "Client A",
  "vendor_name": "Vendor X"
}
```

## Response Example
```json
{
  "id": 1,
  "tenant_id": 1,
  "name": "Client A",
  "status": "active",
  "owner_user_id": 1,
  "address": "123 Main St, Suite 200",
  "sector": "Technology",
  "deleted_at": null
}
```

## Errors
- `400` - Vendor lookup failed when `vendor_id` or `vendor_name` is provided
- `401` - Missing or invalid auth token
- `422` - Validation error (for example invalid `status` value)
