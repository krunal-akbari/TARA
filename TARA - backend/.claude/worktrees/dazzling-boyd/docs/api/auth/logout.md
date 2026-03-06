# Logout

- Method: `POST`
- URL: `/api/v1/auth/logout`
- Auth required: No

## Headers
- `Content-Type: application/json`

## Request Example
```json
{ "refresh_token": "<refresh_token>" }
```

## Response
- Status: `204 No Content`
