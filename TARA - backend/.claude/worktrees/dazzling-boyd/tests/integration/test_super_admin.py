from tests.conftest import auth_header


def _sa_login(client, email="superadmin@tara-ats.com", password="SuperAdmin@123!"):
    r = client.post(
        "/api/v1/super-admin/login",
        json={"email": email, "password": password},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ── Auth ──


def test_seed_super_admin_login(client):
    token = _sa_login(client)
    me = client.get("/api/v1/super-admin/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["email"] == "superadmin@tara-ats.com"
    assert me.json()["is_active"] is True


def test_login_invalid_credentials(client):
    r = client.post(
        "/api/v1/super-admin/login",
        json={"email": "superadmin@tara-ats.com", "password": "WrongPassword1!"},
    )
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid credentials"


def test_login_nonexistent_email(client):
    r = client.post(
        "/api/v1/super-admin/login",
        json={"email": "nobody@tara-ats.com", "password": "Whatever123!"},
    )
    assert r.status_code == 401


# ── RBAC ──


def test_endpoints_reject_unauthenticated(client):
    assert client.get("/api/v1/super-admin/me").status_code == 401
    assert client.get("/api/v1/super-admin/tenants").status_code == 401
    assert client.get("/api/v1/super-admin/admins").status_code == 401
    assert client.post("/api/v1/super-admin/tenants", json={}).status_code == 401
    assert client.post("/api/v1/super-admin/admins", json={}).status_code == 401


def test_tenant_user_token_rejected_on_super_admin_endpoint(client):
    # Create a tenant via super admin, then try to use the tenant user's token
    sa_token = _sa_login(client)
    client.post(
        "/api/v1/super-admin/tenants",
        headers=auth_header(sa_token),
        json={
            "tenant_name": "rbac-test",
            "admin_email": "rbac@example.com",
            "admin_password": "Password123!",
        },
    )
    # Login as tenant user
    tenant_login = client.post(
        "/api/v1/auth/login",
        json={"email": "rbac@example.com", "password": "Password123!"},
    )
    assert tenant_login.status_code == 200
    tenant_token = tenant_login.json()["access_token"]

    # Tenant token must be rejected by super admin endpoints
    r = client.get("/api/v1/super-admin/tenants", headers=auth_header(tenant_token))
    assert r.status_code == 403


# ── Super Admin CRUD ──


def test_create_and_list_super_admins(client):
    sa_token = _sa_login(client)
    h = auth_header(sa_token)

    create = client.post(
        "/api/v1/super-admin/admins",
        headers=h,
        json={"email": "second-sa@tara-ats.com", "password": "SecondSA@123!"},
    )
    assert create.status_code == 201
    assert create.json()["email"] == "second-sa@tara-ats.com"

    admins = client.get("/api/v1/super-admin/admins", headers=h)
    assert admins.status_code == 200
    emails = [a["email"] for a in admins.json()]
    assert "superadmin@tara-ats.com" in emails
    assert "second-sa@tara-ats.com" in emails


def test_create_duplicate_super_admin_fails(client):
    sa_token = _sa_login(client)
    h = auth_header(sa_token)
    client.post(
        "/api/v1/super-admin/admins",
        headers=h,
        json={"email": "dup@tara-ats.com", "password": "DupAdmin@123!"},
    )
    r = client.post(
        "/api/v1/super-admin/admins",
        headers=h,
        json={"email": "dup@tara-ats.com", "password": "DupAdmin@123!"},
    )
    assert r.status_code == 409


def test_new_super_admin_can_login(client):
    sa_token = _sa_login(client)
    client.post(
        "/api/v1/super-admin/admins",
        headers=auth_header(sa_token),
        json={"email": "new-sa@tara-ats.com", "password": "NewSA@12345!"},
    )
    new_token = _sa_login(client, "new-sa@tara-ats.com", "NewSA@12345!")
    me = client.get("/api/v1/super-admin/me", headers=auth_header(new_token))
    assert me.status_code == 200
    assert me.json()["email"] == "new-sa@tara-ats.com"


# ── Tenant CRUD ──


def test_create_list_update_deactivate_tenant(client):
    sa_token = _sa_login(client)
    h = auth_header(sa_token)

    # Create
    create = client.post(
        "/api/v1/super-admin/tenants",
        headers=h,
        json={
            "tenant_name": "Acme Corp",
            "admin_email": "admin@acme.com",
            "admin_password": "AcmePass123!",
            "currency_code": "EUR",
            "timezone": "Europe/Berlin",
        },
    )
    assert create.status_code == 201
    tenant = create.json()
    assert tenant["name"] == "Acme Corp"
    assert tenant["status"] == "active"
    assert tenant["currency_code"] == "EUR"
    tid = tenant["id"]

    # List
    tenants = client.get("/api/v1/super-admin/tenants", headers=h)
    assert tenants.status_code == 200
    assert tenants.json()["total"] >= 1
    names = [t["name"] for t in tenants.json()["items"]]
    assert "Acme Corp" in names

    # Update
    update = client.patch(
        f"/api/v1/super-admin/tenants/{tid}",
        headers=h,
        json={"name": "Acme Inc", "currency_code": "GBP"},
    )
    assert update.status_code == 200
    assert update.json()["name"] == "Acme Inc"
    assert update.json()["currency_code"] == "GBP"

    # Deactivate
    deactivate = client.post(f"/api/v1/super-admin/tenants/{tid}/deactivate", headers=h)
    assert deactivate.status_code == 200
    assert deactivate.json()["status"] == "inactive"


def test_create_duplicate_tenant_fails(client):
    sa_token = _sa_login(client)
    h = auth_header(sa_token)
    client.post(
        "/api/v1/super-admin/tenants",
        headers=h,
        json={
            "tenant_name": "UniqueT",
            "admin_email": "a@uniq.com",
            "admin_password": "Password123!",
        },
    )
    r = client.post(
        "/api/v1/super-admin/tenants",
        headers=h,
        json={
            "tenant_name": "UniqueT",
            "admin_email": "b@uniq.com",
            "admin_password": "Password123!",
        },
    )
    assert r.status_code == 409


def test_update_nonexistent_tenant_returns_404(client):
    sa_token = _sa_login(client)
    r = client.patch(
        "/api/v1/super-admin/tenants/99999",
        headers=auth_header(sa_token),
        json={"name": "Ghost"},
    )
    assert r.status_code == 404


def test_deactivate_nonexistent_tenant_returns_404(client):
    sa_token = _sa_login(client)
    r = client.post(
        "/api/v1/super-admin/tenants/99999/deactivate",
        headers=auth_header(sa_token),
    )
    assert r.status_code == 404


# ── Dashboard & Activity ──


def test_dashboard_returns_stats(client):
    sa_token = _sa_login(client)
    h = auth_header(sa_token)

    r = client.get("/api/v1/super-admin/dashboard", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert data["tenants_total"] == 0
    assert data["admins_total"] >= 1
    assert data["events_total"] >= 1  # at least the seed + login events
    assert isinstance(data["recent_tenants"], list)


def test_dashboard_updates_after_tenant_creation(client):
    sa_token = _sa_login(client)
    h = auth_header(sa_token)

    client.post(
        "/api/v1/super-admin/tenants",
        headers=h,
        json={
            "tenant_name": "DashTest",
            "admin_email": "dash@test.com",
            "admin_password": "DashPass123!",
        },
    )
    r = client.get("/api/v1/super-admin/dashboard", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert data["tenants_total"] >= 1
    assert data["tenants_active"] >= 1
    assert data["users_total"] >= 1  # tenant admin user created
    assert any(t["name"] == "DashTest" for t in data["recent_tenants"])


def test_activity_returns_events(client):
    sa_token = _sa_login(client)
    h = auth_header(sa_token)

    r = client.get("/api/v1/super-admin/activity", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1
    # The login event should be present
    actions = [e["action"] for e in data["items"]]
    assert "login" in actions


def test_activity_records_crud_events(client):
    sa_token = _sa_login(client)
    h = auth_header(sa_token)

    # Create a tenant
    client.post(
        "/api/v1/super-admin/tenants",
        headers=h,
        json={
            "tenant_name": "EventTest",
            "admin_email": "evt@test.com",
            "admin_password": "EvtPass123!",
        },
    )

    r = client.get("/api/v1/super-admin/activity", headers=h)
    assert r.status_code == 200
    items = r.json()["items"]
    actions = [e["action"] for e in items]
    assert "create" in actions
    # Find the tenant creation event
    create_events = [e for e in items if e["action"] == "create" and e["target_type"] == "tenant"]
    assert len(create_events) >= 1
    assert create_events[0]["target_label"] == "EventTest"
    assert create_events[0]["actor_email"] == "superadmin@tara-ats.com"


def test_activity_pagination(client):
    sa_token = _sa_login(client)
    h = auth_header(sa_token)

    r = client.get("/api/v1/super-admin/activity?page=1&page_size=2", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert len(data["items"]) <= 2
    assert data["total"] >= 1


def test_dashboard_requires_auth(client):
    assert client.get("/api/v1/super-admin/dashboard").status_code == 401


def test_activity_requires_auth(client):
    assert client.get("/api/v1/super-admin/activity").status_code == 401


def test_tenant_admin_can_login_after_creation(client):
    sa_token = _sa_login(client)
    client.post(
        "/api/v1/super-admin/tenants",
        headers=auth_header(sa_token),
        json={
            "tenant_name": "LoginTest Corp",
            "admin_email": "tadmin@logintest.com",
            "admin_password": "TAdmin@123!",
        },
    )
    # The tenant admin should be able to log in via the regular auth endpoint
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "tadmin@logintest.com", "password": "TAdmin@123!"},
    )
    assert login.status_code == 200
    assert "access_token" in login.json()
