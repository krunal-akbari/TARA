# Create Vendor

- Method: `POST`
- URL: `/api/v1/vendors`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Body

| Field           | Type           | Required | Description                                      |
|-----------------|----------------|----------|--------------------------------------------------|
| `name`          | string         | Yes      | Vendor name (2-255 chars)                        |
| `status`        | string         | No       | Allowed: `"active"` or `"inactive"`; default `"active"` |
| `client_ids`    | list[int]      | No*      | Client IDs; all must belong to same tenant       |
| `client_names`  | list[string]   | No*      | Client names; looked up by exact match           |
| `address`       | string \| null | No       | Street / postal address (max 512 chars)          |
| `sector`        | string \| null | No       | Industry sector (max 128 chars)                  |

\* At least one of `client_ids` or `client_names` is required. Both can be provided and will be merged (duplicates removed).
The API auto-creates active client-vendor links for each resolved client.

## Request Examples

Using IDs:
```json
{
  "name": "Vendor X",
  "status": "active",
  "client_ids": [1, 2],
  "address": "789 Industrial Blvd",
  "sector": "Healthcare"
}
```

Using names:
```json
{
  "name": "Vendor X",
  "client_names": ["Client A", "Client B"]
}
```

Using both:
```json
{
  "name": "Vendor X",
  "client_ids": [1],
  "client_names": ["Client B"]
}
```

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

## Errors
- `400` - Client lookup failed while resolving `client_ids` or `client_names`
- `401` - Missing or invalid auth token
- `422` - Validation error (for example invalid `status` value)
