export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface UserResponse {
  id: number;
  tenant_id: number;
  email: string;
  is_active: boolean;
  first_name?: string | null;
  last_name?: string | null;
  roles: string[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tenantId: number | null;
  user: UserResponse | null;
}
