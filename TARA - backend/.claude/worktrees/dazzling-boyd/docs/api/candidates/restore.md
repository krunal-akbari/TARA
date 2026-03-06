# Restore Candidate

- Method: `POST`
- URL: `/api/v1/candidates/{candidate_id}/restore`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Response
Returns the full candidate object including the `status` field.
