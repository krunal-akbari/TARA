# Super Admin Account Management

All endpoints require Super Admin authentication.

---

## POST /api/v1/super-admin/admins — Create Super Admin

Allows an authenticated Super Admin to create additional Super Admin
accounts for onboarding purposes.

### Request Body

| Field      | Type   | Required | Description                 |
|------------|--------|----------|-----------------------------|
| `email`    | string | Yes      | New admin email address     |
| `password` | string | Yes      | Password (8-128 characters) |

### Request Example

```json
{
  "email": "ops-admin@company.com",
  "password": "SecurePass@456!"
}
```

### Success Response — `201 Created`

```json
{
  "id": 2,
  "email": "ops-admin@company.com",
  "is_active": true
}
```

### Errors

| Status | Detail                                      |
|--------|---------------------------------------------|
| 401    | Unauthorized (missing/invalid token)        |
| 403    | Super Admin access required                 |
| 409    | A Super Admin with this email already exists|

---

## GET /api/v1/super-admin/admins — List Super Admins

Returns all Super Admin accounts.

### Success Response — `200 OK`

```json
[
  { "id": 1, "email": "superadmin@tara-ats.com", "is_active": true },
  { "id": 2, "email": "ops-admin@company.com", "is_active": true }
]
```
