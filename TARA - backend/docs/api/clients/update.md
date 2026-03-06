# Update Client

- Method: `PATCH`
- URL: `/api/v1/clients/{client_id}`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Body

All fields are optional. Only provided fields are updated.

| Field     | Type           | Description                        |
|-----------|----------------|------------------------------------|
| `name`    | string \| null | Client name (2-255 chars)          |
| `status`  | string \| null | Allowed: `"active"` or `"inactive"` |
| `address` | string \| null | Street / postal address (max 512)  |
| `sector`  | string \| null | Industry sector (max 128)          |

## Request Example
```json
{
  "name": "Client A Updated",
  "status": "inactive",
  "address": "456 Oak Ave",
  "sector": "Finance"
}
```

## Errors
- `401` - Missing or invalid auth token
- `403` - Not allowed to update this client
- `404` - Client not found
- `422` - Validation error (for example invalid `status` value)
