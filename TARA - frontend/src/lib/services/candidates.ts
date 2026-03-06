import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/http";
import { Candidate, CandidateListResponse, DedupeCheckResponse } from "@/lib/types/entities";

interface ListCandidatesQuery {
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

export function listCandidates(query: ListCandidatesQuery = {}) {
  return apiGet<CandidateListResponse>("/api/v1/candidates", {
    include_deleted: query.includeDeleted ?? false,
    page: query.page ?? 1,
    page_size: query.pageSize ?? 20,
  });
}

export function getCandidate(candidateId: number | string, includeDeleted = false) {
  return apiGet<Candidate>(`/api/v1/candidates/${candidateId}`, { include_deleted: includeDeleted });
}

export function createCandidate(payload: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  group_bu?: string;
  current_company?: string;
}) {
  return apiPost<Candidate>("/api/v1/candidates", payload);
}

export function updateCandidate(
  candidateId: number | string,
  payload: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    group_bu?: string;
    current_company?: string;
    hr_notes_general?: string;
    hr_notes_status?: string;
    hr_notes_pay?: string;
    hr_notes_notes?: string;
  },
) {
  return apiPatch<Candidate>(`/api/v1/candidates/${candidateId}`, payload);
}

export function deleteCandidate(candidateId: number | string) {
  return apiDelete(`/api/v1/candidates/${candidateId}`);
}

export function restoreCandidate(candidateId: number | string) {
  return apiPost<Candidate>(`/api/v1/candidates/${candidateId}/restore`);
}

export function dedupeCheck(candidateId: number | string, email?: string, phone?: string) {
  return apiGet<DedupeCheckResponse>(`/api/v1/candidates/${candidateId}/dedupe-check`, { email, phone });
}
