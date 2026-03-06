import axios, { AxiosError, AxiosRequestConfig } from "axios";

import { getStoredSession } from "@/lib/auth-storage";
import { useAuthStore } from "@/lib/auth-store";
import { config } from "@/lib/config";

const api = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

const bare = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.request.use((request) => {
  const session = useAuthStore.getState().session ?? getStoredSession();
  if (session?.tenantId !== null && session?.tenantId !== undefined) {
    request.headers["X-Tenant-Id"] = String(session.tenantId);
  }
  return request;
});

let refreshPromise: Promise<void> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!originalRequest || originalRequest._retry) return Promise.reject(error);
    if (error.response?.status !== 401) return Promise.reject(error);
    const requestPath = originalRequest.url ?? "";
    if (
      requestPath.includes("/api/v1/auth/login") ||
      requestPath.includes("/api/v1/auth/refresh") ||
      requestPath.includes("/api/v1/auth/logout")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = bare
          .post("/api/v1/auth/refresh")
          .then(() => undefined)
          .finally(() => {
            refreshPromise = null;
          });
      }

      await refreshPromise;
      const currentSession = useAuthStore.getState().session ?? getStoredSession();
      originalRequest.headers = {
        ...originalRequest.headers,
      };
      if (currentSession?.tenantId !== null && currentSession?.tenantId !== undefined) {
        originalRequest.headers["X-Tenant-Id"] = String(currentSession.tenantId);
      }
      return api(originalRequest);
    } catch (refreshError) {
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
