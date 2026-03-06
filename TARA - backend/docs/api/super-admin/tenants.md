# Tenant Management (Super Admin)

All endpoints require Super Admin authentication.

> **Important:** Tenants are created exclusively by a Super Admin.
> There is no self-service or public tenant creation path.

---

## POST /api/v1/super-admin/tenants — Create Tenant

Creates a new tenant with its initial admin user and default roles
(admin, manager, recruiter).

### Request Body

| Field                  | Type   | Required | Default | Description                     |
|------------------------|--------|----------|---------|---------------------------------|
| `tenant_name`          | string | Yes      |         | Unique tenant name (2-255 chars)|
| `admin_email`          | string | Yes      |         | Tenant admin email              |
| `admin_password`       | string | Yes      |         | Tenant admin password (8-128)   |
| `currency_code`        | string | No       | `USD`   | ISO currency code               |
| `timezone`             | string | No       | `UTC`   | IANA timezone                   |
| `resume_retention_days`| int    | No       | `365`   | 30-3650                         |
| `audit_retention_days` | int    | No       | `730`   | 90-3650                         |

### Request Example

```json
{
  "tenant_name": "Acme Corp",
  "admin_email": "admin@acme.com",
  "admin_password": "AcmePass123!",
  "currency_code": "EUR",
  "timezone": "Europe/Berlin"
}
```

### Success Response — `201 Created`

```json
{
  "id": 1,
  "name": "Acme Corp",
  "status": "active",
  "currency_code": "EUR",
  "timezone": "Europe/Berlin",
  "resume_retention_days": 365,
  "audit_retention_days": 730
}
```

### Errors

| Status | Detail                 | Condition              |
|--------|------------------------|------------------------|
| 401    | Unauthorized           | Missing/invalid token  |
| 403    | Super Admin required   | Non-super-admin token  |
| 409    | Tenant already exists  | Duplicate tenant name  |

---

## GET /api/v1/super-admin/tenants — List Tenants

### Success Response — `200 OK`

```json
{
  "items": [
    {
      "id": 1,
      "name": "Acme Corp",
      "status": "active",
      "currency_code": "EUR",
      "timezone": "Europe/Berlin",
      "resume_retention_days": 365,
      "audit_retention_days": 730
    }
  ],
  "total": 1
}
```

---

## PATCH /api/v1/super-admin/tenants/{tenant_id} — Update Tenant

All fields are optional; only provided fields are updated.

### Request Body

| Field                  | Type   | Description                |
|------------------------|--------|----------------------------|
| `name`                 | string | New tenant name            |
| `currency_code`        | string | Updated currency code      |
| `timezone`             | string | Updated timezone           |
| `resume_retention_days`| int    | Updated retention (30-3650)|
| `audit_retention_days` | int    | Updated retention (90-3650)|

### Success Response — `200 OK`

Returns the updated tenant object.

### Errors

| Status | Detail           |
|--------|------------------|
| 404    | Tenant not found |

---

## POST /api/v1/super-admin/tenants/{tenant_id}/deactivate — Deactivate Tenant

Sets the tenant status to `inactive`.

### Success Response — `200 OK`

```json
{
  "id": 1,
  "name": "Acme Corp",
  "status": "inactive",
  ...
}
```

### Errors

| Status | Detail           |
|--------|------------------|
| 404    | Tenant not found |

---

## POST /api/v1/super-admin/tenants/{tenant_id}/activate — Activate Tenant

Sets the tenant status back to `active`. Use this to reactivate a
previously deactivated tenant.

### Success Response — `200 OK`

```json
{
  "id": 1,
  "name": "Acme Corp",
  "status": "active",
  ...
}
```

### Errors

| Status | Detail           |
|--------|------------------|
| 404    | Tenant not found |
