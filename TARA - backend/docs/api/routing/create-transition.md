# Create Route Transition

- Method: `POST`
- URL: `/api/v1/jobs/{job_id}/route-transitions`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`
- `Idempotency-Key: <unique_key>` (recommended)

## Request Example
```json
{
  "to_node_type": "client",
  "to_node_id": 1,
  "reason": "submitted",
  "notes": "optional note"
}
```

## `to_node_type` values
- `client`
- `vendor`
