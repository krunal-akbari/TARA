# Table: `user_roles`

- **Model:** `UserRole`
- **Source:** `app/domains/auth/models.py`
- **Mixins:** TimestampMixin, TenantMixin

## Columns

| Column       | Type         | Nullable | Default      | Index | FK           | Notes               |
|-------------|-------------|----------|--------------|-------|--------------|---------------------|
| `id`        | Integer     | No       | autoincrement| PK    | —            | Primary key         |
| `user_id`   | Integer     | No       | —            | Yes   | `users.id`   | The user            |
| `role_id`   | Integer     | No       | —            | Yes   | `roles.id`   | The role            |
| `created_at`| DateTime(tz)| No       | `utcnow()`   | —     | —            | From TimestampMixin |
| `updated_at`| DateTime(tz)| No       | `utcnow()`   | —     | —            | From TimestampMixin |
| `tenant_id` | Integer     | No       | —            | Yes   | `tenants.id` | From TenantMixin    |

## Constraints

- **Primary Key:** `id`
- **Unique:** `uq_user_roles_tenant_user_role` on (`tenant_id`, `user_id`, `role_id`)

## Relationships

- Belongs to: `users`, `roles`, `tenants`
