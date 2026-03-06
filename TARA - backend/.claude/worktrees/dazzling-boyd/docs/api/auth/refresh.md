# Refresh Token

- Method: `POST`
- URL: `/api/v1/auth/refresh`
- Auth required: No

## Headers
- `Content-Type: application/json`

## Request Example
```json
{ "refresh_token": "<refresh_token>" }
```

## Response Example
```json
{
  "access_token": "<new_access_token>",
  "refresh_token": "<new_refresh_token>",
  "token_type": "bearer"
}
```
