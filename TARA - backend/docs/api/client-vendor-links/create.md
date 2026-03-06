# Create Client-Vendor Link

- Method: `POST`
- URL: `/api/v1/client-vendor-links`
- Role required: `admin` or `manager`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Body

| Field            | Type           | Required | Description |
|------------------|----------------|----------|-------------|
| `client_id`      | integer        | Yes      | Client ID in same tenant |
| `vendor_id`      | integer        | Yes      | Vendor ID in same tenant |
| `status`         | string         | No       | Allowed: `"active"` or `"inactive"`; default `"active"` |
| `priority`       | integer        | No       | Range `1-1000`; lower means higher priority; default `100` |
| `effective_from` | datetime \| null | No       | Optional link start date/time |
| `effective_to`   | datetime \| null | No       | Optional link end date/time; must be `>= effective_from` |

## Request Example
```json
{
  "client_id": 1,
  "vendor_id": 1,
  "status": "active",
  "priority": 100,
  "effective_from": "2026-02-01T00:00:00Z",
  "effective_to": "2026-12-31T23:59:59Z"
}
```

## Response `201 Created`
```json
{
  "id": 10,
  "tenant_id": 1,
  "client_id": 1,
  "vendor_id": 1,
  "status": "active",
  "priority": 100,
  "effective_from": "2026-02-01T00:00:00+00:00",
  "effective_to": "2026-12-31T23:59:59+00:00",
  "deleted_at": null
}
```

## Errors
- `400` - Client/vendor not found or link already exists
- `400` - Invalid effective date range (`effective_from > effective_to`)
- `401` - Missing or invalid auth token
- `403` - User does not have required role
- `422` - Validation error (for example invalid `status`, invalid `priority`)
