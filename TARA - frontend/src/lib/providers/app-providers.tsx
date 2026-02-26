"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/lib/auth-store";
import { QueryProvider } from "@/lib/providers/query-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <QueryProvider>{children}</QueryProvider>;
}
