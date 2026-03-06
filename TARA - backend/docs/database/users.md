# Table: `users`

- **Model:** `User`
- **Source:** `app/domains/auth/models.py`
- **Mixins:** TimestampMixin, SoftDeleteMixin, TenantMixin

## Columns

| Column          | Type         | Nullable | Default      | Index | FK             | Notes                    |
|-----------------|-------------|----------|--------------|-------|----------------|--------------------------|
| `id`            | Integer     | No       | autoincrement| PK    | —              | Primary key              |
| `email`         | String(255) | No       | —            | Yes   | —              | User email               |
| `password_hash` | String(255) | No       | —            | —     | —              | Bcrypt hash              |
| `is_active`     | Boolean     | No       | `True`       | —     | —              | Account enabled flag     |
| `first_name`    | String(128) | Yes      | `NULL`       | —     | —              | First name               |
| `last_name`     | String(128) | Yes      | `NULL`       | —     | —              | Last name                |
| `created_at`    | DateTime(tz)| No       | `utcnow()`   | —     | —              | From TimestampMixin      |
| `updated_at`    | DateTime(tz)| No       | `utcnow()`   | —     | —              | From TimestampMixin      |
| `deleted_at`    | DateTime(tz)| Yes      | `NULL`       | —     | —              | From SoftDeleteMixin     |
| `deleted_by`    | Integer     | Yes      | `NULL`       | —     | —              | From SoftDeleteMixin     |
| `tenant_id`     | Integer     | No       | —            | Yes   | `tenants.id`   | From TenantMixin         |

## Constraints

- **Primary Key:** `id`
- **Unique:** `uq_users_tenant_email` on (`tenant_id`, `email`)

## Relationships

- Belongs to: `tenants`
- Has many: `user_roles`, `revoked_tokens`
