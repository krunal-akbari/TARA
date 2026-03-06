# Update Client Contact

- Method: `PATCH`
- URL: `/api/v1/clients/{client_id}/contacts/{contact_id}`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Body

All fields are optional. Only provided fields are updated.

| Field        | Type           | Description                |
|--------------|----------------|----------------------------|
| `first_name` | string \| null | Contact first name (1-128) |
| `last_name`  | string \| null | Contact last name (1-128)  |
| `email`      | string \| null | Email address (max 255)    |
| `phone`      | string \| null | Phone number (max 64)      |

## Request Example
```json
{
  "first_name": "Alice",
  "last_name": "Johnson",
  "phone": "555-9999"
}
```

## Response `200 OK`
```json
{
  "id": 1,
  "client_id": 1,
  "first_name": "Alice",
  "last_name": "Johnson",
  "email": "alice@example.com",
  "phone": "555-9999"
}
```

## Errors
- `404` - Contact not found
- `404` - Contact exists but does not belong to `{client_id}`
- `403` - Not allowed to update contact
- `401` - Missing or invalid auth token
