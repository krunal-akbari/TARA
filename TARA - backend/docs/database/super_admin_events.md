# Table: `super_admin_events`

- **Model:** `SuperAdminEvent`
- **Source:** `app/domains/super_admin/models.py`
- **Mixins:** TimestampMixin

Audit log for super admin actions (tenant creation, admin management, etc.). Not tenant-scoped.

## Columns

| Column         | Type         | Nullable | Default      | Index | FK  | Notes                              |
|----------------|-------------|----------|--------------|-------|-----|------------------------------------|
| `id`           | Integer     | No       | autoincrement| PK    | —   | Primary key                        |
| `actor_id`     | Integer     | No       | —            | Yes   | —   | Super admin who performed action   |
| `actor_email`  | String(255) | No       | —            | —     | —   | Email of the acting admin          |
| `action`       | String(64)  | No       | —            | Yes   | —   | e.g. `create_tenant`, `create_admin` |
| `target_type`  | String(64)  | No       | —            | —     | —   | e.g. `tenant`, `super_admin`       |
| `target_id`    | Integer     | Yes      | `NULL`       | —     | —   | ID of the affected entity          |
| `target_label` | String(255) | No       | `''`         | —     | —   | Human-readable label               |
| `detail`       | JSON        | No       | `{}`         | —     | —   | Event-specific payload             |
| `created_at`   | DateTime(tz)| No       | `utcnow()`   | —     | —   | From TimestampMixin                |
| `updated_at`   | DateTime(tz)| No       | `utcnow()`   | —     | —   | From TimestampMixin                |

## Constraints

- **Primary Key:** `id`

## Relationships

- Related to: `super_admins` (via `actor_id`, no FK constraint)
