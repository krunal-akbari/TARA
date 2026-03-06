# Bootstrap Tenant (Onboarding)

- Method: `POST`
- URL: `/api/v1/admin/tenants/bootstrap`
- Auth required: No
- Required header: `X-Bootstrap-Key`

For restricted public onboarding, use `docs/api/tenancy/public-onboarding.md`.

## Headers
- `Content-Type: application/json`
- `X-Bootstrap-Key: <bootstrap_api_key>`

## Request Example
```json
{
  "tenant_name": "demo",
  "admin_email": "admin@example.com",
  "admin_password": "Password123!",
  "currency_code": "USD",
  "timezone": "UTC",
  "resume_retention_days": 365,
  "audit_retention_days": 730
}
```

## cURL Example
```bash
curl -X POST http://localhost:8000/api/v1/admin/tenants/bootstrap \
  -H "Content-Type: application/json" \
  -H "X-Bootstrap-Key: change-me" \
  -d '{"tenant_name":"demo","admin_email":"admin@example.com","admin_password":"Password123!","currency_code":"USD","timezone":"UTC","resume_retention_days":365,"audit_retention_days":730}'
```

## Response Example
```json
{
  "tenant_id": 1,
  "admin_user_id": 1,
  "default_roles": ["admin", "manager", "recruiter"]
}
```
