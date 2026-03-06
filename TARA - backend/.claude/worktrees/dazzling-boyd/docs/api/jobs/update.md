# Update Job

- Method: `PATCH`
- URL: `/api/v1/jobs/{job_id}`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`
- `Content-Type: application/json`

## Request Example
```json
{ "title": "Python Developer Updated", "intake_channel": "preferred_vendor" }
```
