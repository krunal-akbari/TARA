# Table: `job_route_transitions`

- **Model:** `JobRouteTransition`
- **Source:** `app/domains/routing/models.py`
- **Mixins:** TenantMixin

Records each **routing hop** as a job moves between clients and vendors.

## Columns

| Column            | Type          | Nullable | Default | Index | FK           | Notes                              |
|-------------------|--------------|----------|---------|-------|--------------|------------------------------------|
| `id`              | Integer      | No       | autoincrement | PK | —           | Primary key                        |
| `job_id`          | Integer      | No       | —       | Yes   | `jobs.id`    | The job being routed               |
| `sequence_no`     | Integer      | No       | —       | —     | —            | Ordered sequence (1, 2, 3...)      |
| `from_node_type`  | String(32)   | Yes      | `NULL`  | —     | —            | Previous node type (null for first)|
| `from_node_id`    | Integer      | Yes      | `NULL`  | —     | —            | Previous node ID                   |
| `to_node_type`    | String(32)   | No       | —       | —     | —            | Target node type (`client`/`vendor`)|
| `to_node_id`      | Integer      | No       | —       | —     | —            | Target node ID                     |
| `reason`          | String(64)   | No       | —       | —     | —            | Why the transition happened        |
| `notes`           | String(1000) | Yes      | `NULL`  | —     | —            | Free-text notes                    |
| `actor_user_id`   | Integer      | No       | —       | —     | —            | User who triggered the transition  |
| `idempotency_key` | String(128)  | Yes      | `NULL`  | —     | —            | Prevents duplicate transitions     |
| `occurred_at`     | DateTime(tz) | No       | —       | —     | —            | When the transition occurred       |
| `tenant_id`       | Integer      | No       | —       | Yes   | `tenants.id` | From TenantMixin                   |

## Constraints

- **Primary Key:** `id`
- **Unique:** `uq_route_transition_seq` on (`tenant_id`, `job_id`, `sequence_no`)
- **Unique:** `uq_route_transition_idempotency` on (`tenant_id`, `job_id`, `idempotency_key`)

## Relationships

- Belongs to: `jobs`, `tenants`
