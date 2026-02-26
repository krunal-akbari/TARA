import { apiGet } from "@/lib/api/http";
import { ActivityEventListResponse } from "@/lib/types/entities";

interface AuditQuery {
  entityType?: string;
  entityId?: string;
  page?: number;
  pageSize?: number;
}

export function listActivityEvents(query: AuditQuery = {}) {
  return apiGet<ActivityEventListResponse>("/api/v1/activity-events", {
    entity_type: query.entityType,
    entity_id: query.entityId,
    page: query.page ?? 1,
    page_size: query.pageSize ?? 20,
  });
}
