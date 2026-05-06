# Upload Resume

- Method: `POST`
- URL: `/api/v1/candidates/{candidate_id}/resumes`
- Content type: `multipart/form-data`

## Headers
- `Authorization: Bearer <access_token>`
- `X-Tenant-Id: <tenant_id>`

## Form Data
- `file`: required file upload

## Constraints
- Empty uploads are rejected.
- Maximum size is controlled by `MAX_RESUME_UPLOAD_BYTES` (default `10485760` bytes / 10 MB).
- Resume text extraction supports `PDF`, `DOCX`, `DOC`, and plain-text uploads such as `TXT`.
- Stored object key is generated uniquely per upload (UUID-prefixed), so uploading the same file name does not overwrite prior uploads.

## cURL Example
```bash
curl -X POST http://localhost:8000/api/v1/candidates/<candidate_id>/resumes \
  -H "Authorization: Bearer <access_token>" \
  -H "X-Tenant-Id: <tenant_id>" \
  -F "file=@resume.pdf"
```

## Response `201 Created`
```json
{
  "id": 1,
  "tenant_id": 1,
  "candidate_id": 123,
  "storage_key": "1/123/fd870f47b4b64cb4bb3c89b1384d8d31_resume.pdf",
  "file_name": "resume.pdf",
  "content_type": "application/pdf",
  "size_bytes": 84521,
  "parse_status": "pending",
  "uploaded_by": 17,
  "created_at": "2026-02-17T10:20:00+00:00"
}
```

## Errors
- `400` - Empty upload
- `401` - Missing or invalid auth token
- `404` - Candidate not found
- `413` - File exceeds maximum upload size
- `422` - Multipart/form validation error
