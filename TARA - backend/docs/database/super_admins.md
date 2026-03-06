# Table: `super_admins`

- **Model:** `SuperAdmin`
- **Source:** `app/domains/super_admin/models.py`
- **Mixins:** TimestampMixin

Platform-level administrators who manage tenants. Not scoped to any tenant.

## Columns

| Column          | Type         | Nullable | Default      | Index        | FK  | Notes               |
|-----------------|-------------|----------|--------------|--------------|-----|---------------------|
| `id`            | Integer     | No       | autoincrement| PK           | —   | Primary key         |
| `email`         | String(255) | No       | —            | Yes (unique) | —   | Admin email         |
| `password_hash` | String(255) | No       | —            | —            | —   | Bcrypt hash         |
| `is_active`     | Boolean     | No       | `True`       | —            | —   | Account enabled     |
| `created_at`    | DateTime(tz)| No       | `utcnow()`   | —            | —   | From TimestampMixin |
| `updated_at`    | DateTime(tz)| No       | `utcnow()`   | —            | —   | From TimestampMixin |

## Constraints

- **Primary Key:** `id`
- **Unique:** `email`

## Relationships

- Has many: `super_admin_events`
