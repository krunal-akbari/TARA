import axios, { AxiosError, AxiosRequestConfig } from "axios";

import { clearStoredSession, getStoredSession, setStoredSession } from "@/lib/auth-storage";
import { useAuthStore } from "@/lib/auth-store";
import { config } from "@/lib/config";
import { TokenResponse } from "@/lib/types/auth";

const api = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { "Content-Type": "application/json" },
});

const bare = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((request) => {
  const session = getStoredSession();
  if (session?.accessToken) {
    request.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  if (session?.tenantId !== null && session?.tenantId !== undefined) {
    request.headers["X-Tenant-Id"] = String(session.tenantId);
  }
  return request;
});

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!originalRequest || originalRequest._retry) return Promise.reject(error);
    if (error.response?.status !== 401) return Promise.reject(error);

    const session = getStoredSession();
    if (!session?.refreshToken) {
      clearStoredSession();
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = bare
          .post<TokenResponse>("/api/v1/auth/refresh", {
            refresh_token: session.refreshToken,
          })
          .then((refreshResponse) => {
            const tokens = {
              accessToken: refreshResponse.data.access_token,
              refreshToken: refreshResponse.data.refresh_token,
            };
            const nextSession = { ...getStoredSession()!, ...tokens };
            setStoredSession(nextSession);
            return tokens;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const tokens = await refreshPromise;

      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${tokens.accessToken}`,
      };
      const currentSession = getStoredSession();
      if (currentSession?.tenantId !== null && currentSession?.tenantId !== undefined) {
        originalRequest.headers["X-Tenant-Id"] = String(currentSession.tenantId);
      }
      return api(originalRequest);
    } catch (refreshError) {
      clearStoredSession();
      useAuthStore.getState().clearSession();
      return Promise.reject(refreshError);
    }
  },
);

export async function apiGet<T>(path: string, params?: Record<string, unknown>) {
  const response = await api.get<T>(path, { params });
  return response.data;
}

export async function apiGetBlob(path: string, params?: Record<string, unknown>) {
  const response = await api.get<Blob>(path, {
    params,
    responseType: "blob",
  });
  return response.data;
}

export async function apiPost<T>(path: string, body?: unknown, headers?: Record<string, string>) {
  const response = await api.post<T>(path, body, { headers });
  return response.data;
}

export async function apiPatch<T>(path: string, body?: unknown) {
  const response = await api.patch<T>(path, body);
  return response.data;
}

export async function apiDelete(path: string) {
  await api.delete(path);
}

export async function apiUpload<T>(path: string, formData: FormData) {
  const response = await api.post<T>(path, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | { detail?: unknown; message?: unknown; error?: unknown }
      | string
      | undefined;
    if (typeof payload === "string" && payload.trim().length > 0) return stripHtml(payload);
    if (payload && typeof payload === "object") {
      if (typeof payload.detail === "string" && payload.detail.trim().length > 0) return stripHtml(payload.detail);
      if (typeof payload.message === "string" && payload.message.trim().length > 0) return stripHtml(payload.message);
      if (typeof payload.error === "string" && payload.error.trim().length > 0) return stripHtml(payload.error);
    }
    return error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
