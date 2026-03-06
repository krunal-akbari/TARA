# Table: `revoked_tokens`

- **Model:** `RevokedToken`
- **Source:** `app/domains/auth/models.py`
- **Mixins:** None

## Columns

| Column       | Type         | Nullable | Default | Index        | FK          | Notes                        |
|-------------|-------------|----------|---------|--------------|-------------|------------------------------|
| `id`        | Integer     | No       | autoincrement | PK      | —           | Primary key                  |
| `tenant_id` | Integer     | No       | —       | Yes          | —           | Tenant context (no FK)       |
| `user_id`   | Integer     | No       | —       | Yes          | `users.id`  | The user whose token was revoked |
| `jti`       | String(64)  | No       | —       | Yes (unique) | —           | JWT ID (unique token identifier) |
| `expires_at`| DateTime(tz)| Yes      | `NULL`  | —            | —           | Token expiration time        |
| `revoked_at`| DateTime(tz)| No       | —       | —            | —           | When the token was revoked   |

## Constraints

- **Primary Key:** `id`
- **Unique:** `jti`

## Relationships

- Belongs to: `users`
