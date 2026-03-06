# Table: `roles`

- **Model:** `Role`
- **Source:** `app/domains/auth/models.py`
- **Mixins:** TimestampMixin

## Columns

| Column       | Type         | Nullable | Default      | Index        | FK  | Notes               |
|-------------|-------------|----------|--------------|--------------|-----|---------------------|
| `id`        | Integer     | No       | autoincrement| PK           | —   | Primary key         |
| `name`      | String(64)  | No       | —            | Yes (unique) | —   | Role name (e.g. `admin`, `manager`) |
| `created_at`| DateTime(tz)| No       | `utcnow()`   | —            | —   | From TimestampMixin |
| `updated_at`| DateTime(tz)| No       | `utcnow()`   | —            | —   | From TimestampMixin |

## Constraints

- **Primary Key:** `id`
- **Unique:** `name`

## Relationships

- Referenced by: `user_roles`
