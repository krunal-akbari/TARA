# Operational Report

- Method: `GET`
- URL: `/api/v1/reports/operational`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Response Example
```json
{
  "jobs_total": 10,
  "clients_total": 4,
  "vendors_total": 5,
  "candidates_total": 42,
  "active_links_total": 7,
  "route_transitions_total": 18,
  "route_reason_breakdown": {
    "submitted": 9,
    "forwarded": 6,
    "reopened": 3
  }
}
```
