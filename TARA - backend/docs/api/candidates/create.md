# Create Candidate

- Method: `POST`
- URL: `/api/v1/candidates`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Example
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+1-555-100-2000",
  "current_company": "ABC Corp"
}
```
