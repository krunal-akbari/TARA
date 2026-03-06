# List Vendor Contacts

- Method: `GET`
- URL: `/api/v1/vendors/{vendor_id}/contacts`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Response `200 OK`
```json
[
  {
    "id": 1,
    "vendor_id": 1,
    "first_name": "Bob",
    "last_name": "Jones",
    "email": "bob@vendor.com",
    "phone": "+9876543210"
  },
  {
    "id": 2,
    "vendor_id": 1,
    "first_name": "Carol",
    "last_name": "Lee",
    "email": null,
    "phone": "555-0003"
  }
]
```

## Errors
- `404` — Vendor not found
- `401` — Missing or invalid auth token
