# Postman Guide

## Files
- Collection: `postman/TARA-ATS-Backend.postman_collection.json`
- Environment: `postman/TARA-ATS-Local.postman_environment.json`

## Import Steps
1. Open Postman.
2. Import the collection JSON file.
3. Import the environment JSON file.
4. Select environment `TARA ATS Local`.

## Environment Variables
Set these in Postman environment:
- `base_url` (default: `http://localhost:8000`)
- `bootstrap_key` (must match `.env` `BOOTSTRAP_API_KEY`)
- `onboarding_key` (must be one of `.env` `PUBLIC_ONBOARDING_KEYS`)
- `admin_email`
- `admin_password`

Variables auto-populated by request test scripts:
- `tenant_id`
- `access_token`
- `refresh_token`
- `client_id`
- `vendor_id`
- `link_id`
- `job_id`
- `candidate_id`
- `route_transition_id`

## Recommended Run Order
1. `Health -> Live`
2. `Tenancy -> Public Onboarding` (or `Tenancy -> Bootstrap Tenant`)
3. `Auth -> Login`
4. `Auth -> Me`
5. `Clients -> Create Client`
6. `Vendors -> Create Vendor`
7. `ClientVendorLinks -> Create Link`
8. `Jobs -> Create Job`
9. `Routing -> Create Route Transition`
10. `Candidates -> Create Candidate`
11. `Resumes -> Upload Resume`
12. `Audit -> List Activity Events`
13. `Reporting -> Operational Report`

## Required Headers in Postman
The collection already sets these where needed:
- `Authorization: Bearer {{access_token}}`
- `X-Tenant-Id: {{tenant_id}}`
- `X-Bootstrap-Key: {{bootstrap_key}}` (bootstrap only)
- `X-Onboarding-Key: {{onboarding_key}}` (public onboarding only)
- `Idempotency-Key` on route transition create request

## Notes
- Resume upload uses `form-data` with key `file`.
- `Vendors -> Create Vendor` requires `client_id`, so run `Clients -> Create Client` first.
- If you restart with a fresh DB, rerun bootstrap and login to refresh tokens/IDs.
- You can still use Swagger at `{{base_url}}/docs` for quick checks.
- Endpoint-by-endpoint markdown docs are in `docs/api/` (one file per endpoint).
