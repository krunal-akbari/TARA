# Get Client

- Method: `GET`
- URL: `/api/v1/clients/{client_id}`
- Query: `include_deleted`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Response Example
```json
{
  "id": 1,
  "tenant_id": 1,
  "name": "Client A",
  "status": "active",
  "owner_user_id": 1,
  "address": "123 Main St, Suite 200",
  "sector": "Technology",
  "deleted_at": null
}
```
