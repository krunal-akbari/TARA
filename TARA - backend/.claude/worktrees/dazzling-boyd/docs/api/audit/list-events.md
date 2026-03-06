# List Activity Events

- Method: `GET`
- URL: `/api/v1/activity-events`
- Query: `entity_type` (string), `entity_id` (integer), `page`, `page_size`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Example
`/api/v1/activity-events?entity_type=job&entity_id=42&page=1&page_size=20`

## Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Event ID |
| `tenant_id` | int | Tenant ID |
| `entity_type` | string | e.g. `"job"`, `"candidate"`, `"client"` |
| `entity_id` | int | PK of the referenced entity |
| `event_type` | string | e.g. `"created"`, `"updated"`, `"deleted"` |
| `actor_user_id` | int | User who performed the action |
| `payload_json` | object | Event-specific detail |
