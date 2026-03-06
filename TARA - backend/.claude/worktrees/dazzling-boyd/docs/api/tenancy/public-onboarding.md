# Public Onboarding

- Method: `POST`
- URL: `/api/v1/public/onboarding`
- Auth required: No
- Required header: `X-Onboarding-Key`

## Purpose
Public onboarding endpoint for selected people only.

Access is restricted by:
- onboarding key allowlist (`PUBLIC_ONBOARDING_KEYS`)
- optional admin email allowlist (`PUBLIC_ONBOARDING_ALLOWED_EMAILS`)

## Headers
- `Content-Type: application/json`
- `X-Onboarding-Key: <one_of_allowed_keys>`

## Request Example
```json
{
  "tenant_name": "demo-public",
  "admin_email": "public-admin@example.com",
  "admin_password": "Password123!",
  "currency_code": "USD",
  "timezone": "UTC",
  "resume_retention_days": 365,
  "audit_retention_days": 730
}
```

## cURL Example
```bash
curl -X POST http://localhost:8000/api/v1/public/onboarding \
  -H "Content-Type: application/json" \
  -H "X-Onboarding-Key: public-key-1" \
  -d '{"tenant_name":"demo-public","admin_email":"public-admin@example.com","admin_password":"Password123!","currency_code":"USD","timezone":"UTC","resume_retention_days":365,"audit_retention_days":730}'
```

## Success Response
```json
{
  "tenant_id": 1,
  "admin_user_id": 1,
  "default_roles": ["admin", "manager", "recruiter"]
}
```

## Error Responses
- `401 Invalid onboarding key`
- `403 Admin email is not allowed for public onboarding`
- `503 Public onboarding is not configured`
