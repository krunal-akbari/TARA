import { apiGet, apiGetBlob, apiPost, apiUpload } from "@/lib/api/http";
import { Resume, ResumeListResponse } from "@/lib/types/entities";

interface ResumeQuery {
  page?: number;
  pageSize?: number;
}

export interface ResumeExtractPreview {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  current_company: string | null;
}

export interface ResumeTextPreview {
  text: string;
}

export function listResumes(candidateId: number | string, query: ResumeQuery = {}) {
  return apiGet<ResumeListResponse>(`/api/v1/candidates/${candidateId}/resumes`, {
    page: query.page ?? 1,
    page_size: query.pageSize ?? 20,
  });
}

export function uploadResume(candidateId: number | string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<Resume>(`/api/v1/candidates/${candidateId}/resumes`, formData);
}

export function retryResumeParse(candidateId: number | string, resumeId: number | string) {
  return apiPost<Resume>(`/api/v1/candidates/${candidateId}/resumes/${resumeId}/retry-parse`);
}

export function getResumeContent(candidateId: number | string, resumeId: number | string) {
  return apiGetBlob(`/api/v1/candidates/${candidateId}/resumes/${resumeId}/content`);
}

export function getResumePreviewText(candidateId: number | string, resumeId: number | string) {
  return apiGet<ResumeTextPreview>(`/api/v1/candidates/${candidateId}/resumes/${resumeId}/preview-text`);
}

export function extractResumePreview(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<ResumeExtractPreview>("/api/v1/resumes/extract-preview", formData);
}

export function getResumeStatusPollInterval(response?: Pick<ResumeListResponse, "items"> | null) {
  return response?.items.some((resume) => resume.parse_status === "pending" || resume.parse_status === "processing")
    ? 3000
    : false;
}
