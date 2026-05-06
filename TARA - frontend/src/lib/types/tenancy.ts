export interface TenantBootstrapRequest {
  tenant_name: string;
  admin_email: string;
  admin_password: string;
  currency_code?: string;
  timezone?: string;
  resume_retention_days?: number;
  audit_retention_days?: number;
}

export interface TenantBootstrapResponse {
  tenant_id: number;
  admin_user_id: number;
  default_roles: string[];
}

export interface TenantResumeUploadSettingsResponse {
  tenant_id: number;
  tenant_name: string;
  bulk_parse_resume_limit_mb: number;
  bulk_parse_resume_limit_bytes: number;
  uses_system_default: boolean;
}

export interface TenantResumeUploadSettingsUpdateRequest {
  bulk_parse_resume_limit_mb: number | null;
}

