# Update Client-Vendor Link

- Method: `PATCH`
- URL: `/api/v1/client-vendor-links/{link_id}`
- Role required: `admin` or `manager`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Body

All fields are optional. Only provided fields are updated.

| Field            | Type           | Description |
|------------------|----------------|-------------|
| `status`         | string \| null   | Allowed: `"active"` or `"inactive"` |
| `priority`       | integer \| null  | Range `1-1000`; lower means higher priority |
| `effective_from` | datetime \| null | Optional link start date/time |
| `effective_to`   | datetime \| null | Optional link end date/time; must be `>= effective_from` after update |

## Request Example
```json
{
  "status": "inactive",
  "priority": 10,
  "effective_to": "2026-11-30T23:59:59Z"
}
```

## Response `200 OK`
```json
{
  "id": 10,
  "tenant_id": 1,
  "client_id": 1,
  "vendor_id": 1,
  "status": "inactive",
  "priority": 10,
  "effective_from": "2026-02-01T00:00:00+00:00",
  "effective_to": "2026-11-30T23:59:59+00:00",
  "deleted_at": null
}
```

## Errors
- `400` - Invalid effective date range
- `401` - Missing or invalid auth token
- `403` - User does not have required role
- `404` - Link not found
- `422` - Validation error (for example invalid `status`, invalid `priority`)
