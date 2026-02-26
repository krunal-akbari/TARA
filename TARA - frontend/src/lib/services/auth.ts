import { apiGet, apiPost } from "@/lib/api/http";
import { LoginRequest, LogoutRequest, RefreshRequest, TokenResponse, UserResponse } from "@/lib/types/auth";

export function login(payload: LoginRequest) {
  return apiPost<TokenResponse>("/api/v1/auth/login", payload);
}

export function refresh(payload: RefreshRequest) {
  return apiPost<TokenResponse>("/api/v1/auth/refresh", payload);
}

export function logout(payload: LogoutRequest) {
  return apiPost<void>("/api/v1/auth/logout", payload);
}

export function me() {
  return apiGet<UserResponse>("/api/v1/auth/me");
}
