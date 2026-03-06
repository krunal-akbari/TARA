from pydantic import BaseModel


class OperationalReportResponse(BaseModel):
    jobs_total: int
    clients_total: int
    vendors_total: int
    candidates_total: int
    active_links_total: int
    route_transitions_total: int
    route_reason_breakdown: dict[str, int]
