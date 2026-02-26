import { create } from "zustand";

import { clearStoredSession, getStoredSession, setStoredSession } from "@/lib/auth-storage";
import { AuthSession, UserResponse } from "@/lib/types/auth";

interface AuthState {
  session: AuthSession | null;
  hydrated: boolean;
  hydrate: () => void;
  setSession: (session: AuthSession) => void;
  setUser: (user: UserResponse) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const session = getStoredSession();
    set({ session, hydrated: true });
  },
  setSession: (session) => {
    setStoredSession(session);
    set({ session, hydrated: true });
  },
  setUser: (user) => {
    const session = get().session;
    if (!session) return;
    const updated = { ...session, user };
    setStoredSession(updated);
    set({ session: updated });
  },
  clearSession: () => {
    clearStoredSession();
    set({ session: null, hydrated: true });
  },
}));
