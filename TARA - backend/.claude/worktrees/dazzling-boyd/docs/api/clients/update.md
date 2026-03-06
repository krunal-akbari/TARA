# Update Client

- Method: `PATCH`
- URL: `/api/v1/clients/{client_id}`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Example
```json
{ "name": "Client A Updated", "status": "inactive" }
```
