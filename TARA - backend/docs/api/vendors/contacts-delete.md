# Delete Vendor Contact

- Method: `DELETE`
- URL: `/api/v1/vendors/{vendor_id}/contacts/{contact_id}`
- Auth required: Yes

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Response
`204 No Content`

This is a hard delete (the contact row is removed).

## Errors
- `404` - Contact not found
- `404` - Contact exists but does not belong to `{vendor_id}`
- `403` - Not allowed to delete contact
- `401` - Missing or invalid auth token
