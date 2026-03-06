# Signup

There is no dedicated public `signup` endpoint in the current backend.

## Current Onboarding Flow
Use one of these onboarding APIs:
- Public restricted onboarding:
  - `POST /api/v1/public/onboarding`
  - See: `docs/api/tenancy/public-onboarding.md`
- Admin bootstrap onboarding:
- `POST /api/v1/admin/tenants/bootstrap`
- See: `docs/api/tenancy/bootstrap.md`

## Why
This backend is tenant-admin bootstrapped first, then users authenticate via login.

## If You Need Public Signup
Implement a new endpoint like `POST /api/v1/auth/signup` with:
- tenant creation or tenant join logic
- email uniqueness constraints per tenant
- password policy and verification flow
