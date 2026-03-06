# Current Route

- Method: `GET`
- URL: `/api/v1/jobs/{job_id}/current-route`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Response Example
```json
{
  "job_id": 1,
  "current_node_type": "client",
  "current_node_id": 1,
  "status": "active",
  "last_transition_seq": 3,
  "created_at": "2026-02-12T10:00:00Z",
  "updated_at": "2026-02-12T12:00:00Z"
}
```
