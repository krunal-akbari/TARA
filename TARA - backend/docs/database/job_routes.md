# Table: `job_routes`

- **Model:** `JobRoute`
- **Source:** `app/domains/routing/models.py`
- **Mixins:** TimestampMixin, TenantMixin

Tracks the **current routing position** of a job (which client or vendor it is currently at).

## Columns

| Column               | Type         | Nullable | Default      | Index | FK           | Notes                           |
|----------------------|-------------|----------|--------------|-------|--------------|---------------------------------|
| `id`                 | Integer     | No       | autoincrement| PK    | —            | Primary key                     |
| `job_id`             | Integer     | No       | —            | Yes   | `jobs.id`    | The job being routed            |
| `current_node_type`  | String(32)  | No       | —            | —     | —            | `client` or `vendor`            |
| `current_node_id`    | Integer     | No       | —            | —     | —            | ID of the current client/vendor |
| `status`             | String(32)  | No       | `'active'`   | —     | —            | Route status                    |
| `last_transition_seq`| Integer     | No       | `0`          | —     | —            | Sequence number of last transition |
| `created_at`         | DateTime(tz)| No       | `utcnow()`   | —     | —            | From TimestampMixin             |
| `updated_at`         | DateTime(tz)| No       | `utcnow()`   | —     | —            | From TimestampMixin             |
| `tenant_id`          | Integer     | No       | —            | Yes   | `tenants.id` | From TenantMixin                |

## Constraints

- **Primary Key:** `id`
- **Unique:** `uq_job_routes_tenant_job` on (`tenant_id`, `job_id`) — one route per job per tenant

## Relationships

- Belongs to: `jobs`, `tenants`
