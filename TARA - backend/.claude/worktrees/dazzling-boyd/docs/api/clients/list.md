# List Clients

- Method: `GET`
- URL: `/api/v1/clients`
- Query: `include_deleted`, `page`, `page_size`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Example
`/api/v1/clients?include_deleted=false&page=1&page_size=20`
