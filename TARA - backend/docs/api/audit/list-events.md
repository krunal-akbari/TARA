# List Activity Events

- Method: `GET`
- URL: `/api/v1/activity-events`
- Query: `entity_type`, `entity_id`, `page`, `page_size`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Example
`/api/v1/activity-events?entity_type=job&page=1&page_size=20`
