import { apiPost } from "@/lib/api/http";
import { TenantBootstrapRequest, TenantBootstrapResponse } from "@/lib/types/tenancy";

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
