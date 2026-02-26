import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/http";
import { Job, JobListResponse } from "@/lib/types/entities";

interface ListJobsQuery {
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

export function listJobs(query: ListJobsQuery = {}) {
  return apiGet<JobListResponse>("/api/v1/jobs", {
    include_deleted: query.includeDeleted ?? false,
    page: query.page ?? 1,
    page_size: query.pageSize ?? 20,
  });
}

export function getJob(jobId: number | string, includeDeleted = false) {
  return apiGet<Job>(`/api/v1/jobs/${jobId}`, { include_deleted: includeDeleted });
}

export function createJob(payload: {
  title: string;
  description?: string;
  status?: string;
  intake_channel?: string;
  origin_client_id?: number | null;
  origin_vendor_id?: number | null;
}) {
  return apiPost<Job>("/api/v1/jobs", payload);
}

export function updateJob(
  jobId: number | string,
  payload: { title?: string; description?: string; status?: string; intake_channel?: string },
) {
  return apiPatch<Job>(`/api/v1/jobs/${jobId}`, payload);
}

export function deleteJob(jobId: number | string) {
  return apiDelete(`/api/v1/jobs/${jobId}`);
}

export function restoreJob(jobId: number | string) {
  return apiPost<Job>(`/api/v1/jobs/${jobId}/restore`);
}
