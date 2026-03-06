# Create Client Contact

- Method: `POST`
- URL: `/api/v1/clients/{client_id}/contacts`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Body

| Field        | Type           | Required | Description                  |
|--------------|----------------|----------|------------------------------|
| `first_name` | string         | Yes      | Contact first name (1-128)   |
| `last_name`  | string         | Yes      | Contact last name (1-128)    |
| `email`      | string \| null | No       | Email address (max 255)      |
| `phone`      | string \| null | No       | Phone number (max 64)        |

## Request Example
```json
{
  "first_name": "Alice",
  "last_name": "Smith",
  "email": "alice@example.com",
  "phone": "+1234567890"
}
```

## Response `201 Created`
```json
{
  "id": 1,
  "client_id": 1,
  "first_name": "Alice",
  "last_name": "Smith",
  "email": "alice@example.com",
  "phone": "+1234567890"
}
```

## Errors
- `404` — Client not found
- `401` — Missing or invalid auth token
