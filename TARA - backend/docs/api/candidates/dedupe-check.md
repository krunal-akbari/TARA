# Candidate Dedupe Check

- Method: `GET`
- URL: `/api/v1/candidates/{candidate_id}/dedupe-check`
- Query: `email`, `phone`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Example
`/api/v1/candidates/{candidate_id}/dedupe-check?email=john@example.com&phone=5551002000`
