import { z } from "zod";

import { AuthSession } from "@/lib/types/auth";

const KEY = "tara_auth_session";

const authSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tenantId: z.number().nullable(),
  user: z
    .object({
      id: z.number(),
      tenant_id: z.number(),
      email: z.string(),
      is_active: z.boolean(),
      first_name: z.string().nullable().optional(),
      last_name: z.string().nullable().optional(),
      roles: z.array(z.string()),
    })
    .nullable(),
});

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = authSessionSchema.safeParse(parsed);
    if (!result.success) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
