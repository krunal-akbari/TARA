# Table: `activity_events`

- **Model:** `ActivityEvent`
- **Source:** `app/domains/audit/models.py`
- **Mixins:** TimestampMixin, TenantMixin

Append-only audit log that records all significant actions across the system.

## Columns

| Column          | Type         | Nullable | Default      | Index | FK           | Notes                          |
|-----------------|-------------|----------|--------------|-------|--------------|--------------------------------|
| `id`            | Integer     | No       | autoincrement| PK    | —            | Primary key                    |
| `entity_type`   | String(64)  | No       | —            | Yes   | —            | e.g. `client`, `vendor`, `job` |
| `entity_id`     | String(36)  | No       | —            | Yes   | —            | ID of the affected entity      |
| `event_type`    | String(64)  | No       | —            | Yes   | —            | `created`, `updated`, `deleted`|
| `actor_user_id` | Integer     | No       | —            | Yes   | —            | User who performed the action  |
| `payload_json`  | JSON        | No       | `{}`         | —     | —            | Event-specific data            |
| `created_at`    | DateTime(tz)| No       | `utcnow()`   | —     | —            | From TimestampMixin            |
| `updated_at`    | DateTime(tz)| No       | `utcnow()`   | —     | —            | From TimestampMixin            |
| `tenant_id`     | Integer     | No       | —            | Yes   | `tenants.id` | From TenantMixin               |

## Constraints

- **Primary Key:** `id`

## Relationships

- Belongs to: `tenants`
