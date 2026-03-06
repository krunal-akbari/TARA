# Login

- Method: `POST`
- URL: `/api/v1/auth/login`
- Auth required: No

> **Note:** No user ID, tenant ID, or any other identifier is required or accepted
> in the login request. Only `email` and `password` are needed.

## Headers
- `Content-Type: application/json`

## Request Body

| Field      | Type   | Required | Description                       |
|------------|--------|----------|-----------------------------------|
| `email`    | string | Yes      | User email address                |
| `password` | string | Yes      | User password (8-128 characters)  |

## Request Example
```json
{
  "email": "admin@example.com",
  "password": "Password123!"
}
```

## cURL Example
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Password123!"}'
```

## Success Response

**Status:** `200 OK`

| Field           | Type   | Description              |
|-----------------|--------|--------------------------|
| `access_token`  | string | JWT access token         |
| `refresh_token` | string | JWT refresh token        |
| `token_type`    | string | Always `"bearer"`        |

```json
{
  "access_token": "<jwt_access_token>",
  "refresh_token": "<jwt_refresh_token>",
  "token_type": "bearer"
}
```

## Error Responses

| Status | Detail                | Condition                        |
|--------|-----------------------|----------------------------------|
| 401    | `Invalid credentials` | Email not found or wrong password |
| 422    | Validation error      | Missing/invalid fields            |
