export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthActionResponse {
  status: string;
  message: string;
}

export interface RefreshRequest {
  refresh_token?: string;
}

export interface LogoutRequest {
  refresh_token?: string;
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
  tenantId: number | null;
  user: UserResponse | null;
}
