# List Client Contacts

- Method: `GET`
- URL: `/api/v1/clients/{client_id}/contacts`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Response `200 OK`
```json
[
  {
    "id": 1,
    "client_id": 1,
    "first_name": "Alice",
    "last_name": "Smith",
    "email": "alice@example.com",
    "phone": "+1234567890"
  },
  {
    "id": 2,
    "client_id": 1,
    "first_name": "Bob",
    "last_name": "Jones",
    "email": null,
    "phone": "555-0002"
  }
]
```

## Errors
- `404` — Client not found
- `401` — Missing or invalid auth token
