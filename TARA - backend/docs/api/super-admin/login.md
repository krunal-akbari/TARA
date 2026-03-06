# Super Admin Login

- Method: `POST`
- URL: `/api/v1/super-admin/login`
- Auth required: No

> **Note:** Only `email` and `password` are required. No ID field is
> accepted. This endpoint authenticates Super Admin accounts only —
> regular tenant users cannot log in here.

## Request Body

| Field      | Type   | Required | Description                      |
|------------|--------|----------|----------------------------------|
| `email`    | string | Yes      | Super Admin email address        |
| `password` | string | Yes      | Password (8-128 characters)      |

## Request Example

```json
{
  "email": "superadmin@tara-ats.com",
  "password": "SuperAdmin@123!"
}
```

## cURL Example

```bash
curl -X POST http://localhost:8000/api/v1/super-admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@tara-ats.com","password":"SuperAdmin@123!"}'
```

## Success Response

**Status:** `200 OK`

| Field           | Type   | Description       |
|-----------------|--------|-------------------|
| `access_token`  | string | JWT access token  |
| `refresh_token` | string | JWT refresh token |
| `token_type`    | string | Always `"bearer"` |

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "token_type": "bearer"
}
```

## Error Responses

| Status | Detail                | Condition                                |
|--------|-----------------------|------------------------------------------|
| 401    | `Invalid credentials` | Email not found or wrong password        |
| 422    | Validation error      | Missing or invalid fields                |

## GET /api/v1/super-admin/me

Returns the currently authenticated Super Admin profile.

**Auth required:** Yes (`Authorization: Bearer <access_token>`)

### Response Example

```json
{
  "id": 1,
  "email": "superadmin@tara-ats.com",
  "is_active": true
}
```
