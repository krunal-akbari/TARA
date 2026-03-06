"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthStore } from "@/lib/auth-store";
import { me } from "@/lib/services/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const session = useAuthStore((state) => state.session);
  const hydrated = useAuthStore((state) => state.hydrated);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !hydrated) return;
    if (session?.user) {
      return;
    }

    let active = true;
    me()
      .then((user) => {
        if (!active) return;
        setSession({
          tenantId: user.tenant_id,
          user,
        });
      })
      .catch(() => {
        if (!active) return;
        clearSession();
        router.replace("/login");
      });

    return () => {
      active = false;
    };
  }, [mounted, hydrated, session, router, setSession, clearSession]);

  if (!mounted || !hydrated || !session) {
    return (
      <div className="p-8 text-sm text-slate-600">Checking session...</div>
    );
  }

  return <>{children}</>;
}
