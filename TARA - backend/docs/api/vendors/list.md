# List Vendors

- Method: `GET`
- URL: `/api/v1/vendors`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Query Parameters

| Parameter        | Type    | Default | Description                                      |
|------------------|---------|---------|--------------------------------------------------|
| `search`         | string  | —       | Case-insensitive partial match on vendor name    |
| `include_deleted` | bool   | false   | Include soft-deleted vendors                     |
| `page`           | int     | 1       | Page number (>= 1)                               |
| `page_size`      | int     | 20      | Items per page (1-100)                           |

## Example
`/api/v1/vendors?search=health&page=1&page_size=20`

## Response Example
```json
{
  "items": [
    {
      "id": 1,
      "tenant_id": 1,
      "name": "Vendor X",
      "status": "active",
      "owner_user_id": 1,
      "address": "789 Industrial Blvd",
      "sector": "Healthcare",
      "deleted_at": null
    }
  ],
  "total": 1
}
```
