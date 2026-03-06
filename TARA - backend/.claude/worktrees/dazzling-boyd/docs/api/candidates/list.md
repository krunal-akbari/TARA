# List Candidates

- Method: `GET`
- URL: `/api/v1/candidates`
- Query: `include_deleted`, `page`, `page_size`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Response
Returns `{ "items": [...], "total": int }`. Each item includes the `status` field (`"active"` by default).
