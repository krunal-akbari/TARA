import { apiGet, apiPatch, apiPost } from "@/lib/api/http";
import {
  TenantBootstrapRequest,
  TenantBootstrapResponse,
  TenantResumeUploadSettingsResponse,
  TenantResumeUploadSettingsUpdateRequest,
} from "@/lib/types/tenancy";

export function publicOnboarding(payload: TenantBootstrapRequest, onboardingKey: string) {
  return apiPost<TenantBootstrapResponse>("/api/v1/public/onboarding", payload, {
    "X-Onboarding-Key": onboardingKey,
  });
}

export function bootstrapTenant(payload: TenantBootstrapRequest, bootstrapKey: string) {
  return apiPost<TenantBootstrapResponse>("/api/v1/admin/tenants/bootstrap", payload, {
    "X-Bootstrap-Key": bootstrapKey,
  });
}

export function getTenantResumeUploadSettings() {
  return apiGet<TenantResumeUploadSettingsResponse>("/api/v1/tenants/me/settings/resume-upload");
}

export function updateTenantResumeUploadSettings(payload: TenantResumeUploadSettingsUpdateRequest) {
  return apiPatch<TenantResumeUploadSettingsResponse>("/api/v1/tenants/me/settings/resume-upload", payload);
}
