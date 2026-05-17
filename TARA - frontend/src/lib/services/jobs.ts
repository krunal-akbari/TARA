import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/http";
import {
  CandidateJobApplicationListResponse,
  Job,
  JobApplication,
  JobApplicationListResponse,
  JobListResponse,
} from "@/lib/types/entities";

interface ListJobsQuery {
  includeDeleted?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function listJobs(query: ListJobsQuery = {}) {
  return apiGet<JobListResponse>("/api/v1/jobs", {
    include_deleted: query.includeDeleted ?? false,
    search: query.search,
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
  group_bu?: string;
  origin_client_id?: number | null;
  origin_vendor_id?: number | null;
}) {
  return apiPost<Job>("/api/v1/jobs", payload);
}

export function updateJob(
  jobId: number | string,
  payload: { title?: string; description?: string; status?: string; intake_channel?: string; group_bu?: string },
) {
  return apiPatch<Job>(`/api/v1/jobs/${jobId}`, payload);
}

export function deleteJob(jobId: number | string) {
  return apiDelete(`/api/v1/jobs/${jobId}`);
}

export function restoreJob(jobId: number | string) {
  return apiPost<Job>(`/api/v1/jobs/${jobId}/restore`);
}

interface ListJobApplicationsQuery {
  page?: number;
  pageSize?: number;
}

export function applyCandidateToJob(jobId: number | string, payload: { candidate_id: number }) {
  return apiPost<JobApplication>(`/api/v1/jobs/${jobId}/applications`, payload);
}

export function listJobApplications(jobId: number | string, query: ListJobApplicationsQuery = {}) {
  return apiGet<JobApplicationListResponse>(`/api/v1/jobs/${jobId}/applications`, {
    page: query.page ?? 1,
    page_size: query.pageSize ?? 20,
  });
}

export function updateJobApplicationStatus(
  jobId: number | string,
  applicationId: number | string,
  payload: { status: string },
) {
  return apiPatch<JobApplication>(`/api/v1/jobs/${jobId}/applications/${applicationId}`, payload);
}

export function listCandidateJobApplications(candidateId: number | string, query: ListJobApplicationsQuery = {}) {
  return apiGet<CandidateJobApplicationListResponse>(`/api/v1/jobs/candidate/${candidateId}/applications`, {
    page: query.page ?? 1,
    page_size: query.pageSize ?? 20,
  });
}
