# Import model modules so SQLAlchemy metadata has all tables.
from app.domains.audit import models as audit_models  # noqa: F401
from app.domains.auth import models as auth_models  # noqa: F401
from app.domains.candidates import models as candidate_models  # noqa: F401
from app.domains.client_vendor_links import models as link_models  # noqa: F401
from app.domains.clients import models as client_models  # noqa: F401
from app.domains.jobs import models as job_models  # noqa: F401
from app.domains.resumes import models as resume_models  # noqa: F401
from app.domains.routing import models as route_models  # noqa: F401
from app.domains.super_admin import models as super_admin_models  # noqa: F401
from app.domains.tenancy import models as tenancy_models  # noqa: F401
from app.domains.vendors import models as vendor_models  # noqa: F401
