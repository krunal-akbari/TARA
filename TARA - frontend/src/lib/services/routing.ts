import { apiGet, apiPost } from "@/lib/api/http";
import { CurrentRoute, RouteTransition, RouteTransitionListResponse } from "@/lib/types/entities";

interface ListTransitionsQuery {
  page?: number;
  pageSize?: number;
}

export function currentRoute(jobId: number | string) {
  return apiGet<CurrentRoute>(`/api/v1/jobs/${jobId}/current-route`);
}

export function listTransitions(jobId: number | string, query: ListTransitionsQuery = {}) {
  return apiGet<RouteTransitionListResponse>(`/api/v1/jobs/${jobId}/route-transitions`, {
    page: query.page ?? 1,
    page_size: query.pageSize ?? 20,
  });
}

export function createTransition(
  jobId: number | string,
  payload: { to_node_type: string; to_node_id: number; reason?: string; notes?: string | null },
  idempotencyKey: string,
) {
  return apiPost<RouteTransition>(`/api/v1/jobs/${jobId}/route-transitions`, payload, {
    "Idempotency-Key": idempotencyKey,
  });
}
