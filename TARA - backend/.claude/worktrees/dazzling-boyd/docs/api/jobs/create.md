# Create Job

- Method: `POST`
- URL: `/api/v1/jobs`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Example
```json
{
  "title": "Python Developer",
  "description": "5+ years backend",
  "status": "draft",
  "intake_channel": "direct_client",
  "origin_client_id": null,
  "origin_vendor_id": null
}
```

## Intake Channel Values
- `direct_client`
- `preferred_vendor`
- `marketplace`

## Response Fields
- `id`, `tenant_id`, and `owner_user_id` are integers.
