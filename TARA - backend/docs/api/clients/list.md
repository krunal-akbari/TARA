# List Clients

- Method: `GET`
- URL: `/api/v1/clients`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Query Parameters

| Parameter        | Type    | Default | Description                                      |
|------------------|---------|---------|--------------------------------------------------|
| `search`         | string  | —       | Case-insensitive partial match on client name    |
| `include_deleted` | bool   | false   | Include soft-deleted clients                     |
| `page`           | int     | 1       | Page number (>= 1)                               |
| `page_size`      | int     | 20      | Items per page (1-100)                           |

## Example
`/api/v1/clients?search=acme&page=1&page_size=20`

## Response Example
```json
{
  "items": [
    {
      "id": 1,
      "tenant_id": 1,
      "name": "Client A",
      "status": "active",
      "owner_user_id": 1,
      "address": "123 Main St",
      "sector": "Technology",
      "deleted_at": null
    }
  ],
  "total": 1
}
```
