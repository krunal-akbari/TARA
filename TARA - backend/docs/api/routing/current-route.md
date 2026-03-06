# Current Route

- Method: `GET`
- URL: `/api/v1/jobs/{job_id}/current-route`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Response Example
```json
{
  "job_id": "<job_id>",
  "current_node_type": "client",
  "current_node_id": "<client_id>",
  "status": "active",
  "last_transition_seq": 3,
  "updated_at": "2026-02-12T12:00:00Z"
}
```
