# Create Vendor Contact

- Method: `POST`
- URL: `/api/v1/vendors/{vendor_id}/contacts`
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
  "first_name": "Bob",
  "last_name": "Jones",
  "email": "bob@vendor.com",
  "phone": "+9876543210"
}
```

## Response `201 Created`
```json
{
  "id": 1,
  "vendor_id": 1,
  "first_name": "Bob",
  "last_name": "Jones",
  "email": "bob@vendor.com",
  "phone": "+9876543210"
}
```

## Errors
- `404` — Vendor not found
- `401` — Missing or invalid auth token
