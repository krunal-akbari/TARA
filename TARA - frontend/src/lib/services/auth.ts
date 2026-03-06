import { apiGet, apiPost } from "@/lib/api/http";
import {
  AuthActionResponse,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
  UserResponse,
} from "@/lib/types/auth";

export function login(payload: LoginRequest) {
  return apiPost<AuthActionResponse>("/api/v1/auth/login", payload);
}

export function refresh(payload?: RefreshRequest) {
  return apiPost<AuthActionResponse>("/api/v1/auth/refresh", payload);
}

export function logout(payload?: LogoutRequest) {
  return apiPost<void>("/api/v1/auth/logout", payload);
}

export function me() {
  return apiGet<UserResponse>("/api/v1/auth/me");
}
