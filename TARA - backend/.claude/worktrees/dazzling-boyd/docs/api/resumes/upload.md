# Upload Resume

- Method: `POST`
- URL: `/api/v1/candidates/{candidate_id}/resumes`
- Content type: `multipart/form-data`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Form Data
- `file`: required file upload

## cURL Example
```bash
curl -X POST http://localhost:8000/api/v1/candidates/<candidate_id>/resumes \
  -H "Authorization: Bearer <access_token>" \
  -H "X-Tenant-Id: <tenant_id>" \
  -F "file=@resume.pdf"
```
