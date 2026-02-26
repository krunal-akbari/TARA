"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/lib/auth-store";
import { login, me } from "@/lib/services/auth";

const TAB_STORAGE_KEY = "tara_open_tabs_v2";
const LAST_PROTECTED_ROUTE_KEY = "tara_last_protected_route_v1";
const PROTECTED_ROUTE_PREFIXES = ["/dashboard", "/clients", "/vendors", "/jobs", "/candidates", "/links", "/audit", "/reporting"];

function isAllowedProtectedRoute(path: string) {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function getPostLoginRoute() {
  try {
    const storedLastRoute = window.localStorage.getItem(LAST_PROTECTED_ROUTE_KEY);
    if (storedLastRoute && isAllowedProtectedRoute(storedLastRoute)) return storedLastRoute;

    const rawTabs = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (!rawTabs) return "/dashboard";
    const parsed = JSON.parse(rawTabs) as unknown;
    if (!Array.isArray(parsed)) return "/dashboard";

    const tabRoutes = parsed
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "href" in item && typeof item.href === "string") return item.href;
        return null;
      })
      .filter((value): value is string => Boolean(value) && isAllowedProtectedRoute(value));

    return tabRoutes[tabRoutes.length - 1] ?? "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const hydrated = useAuthStore((state) => state.hydrated);
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && session?.accessToken) {
      router.replace(getPostLoginRoute());
    }
  }, [hydrated, session, router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const tokens = await login({ email, password });

      setSession({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tenantId: null,
        user: null,
      });

      const current = await me();
      setSession({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tenantId: current.tenant_id,
        user: current,
      });

      router.replace(getPostLoginRoute());
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to login"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid bg-slate-100 md:grid-cols-[2.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#4a91d8] md:block" aria-hidden="true">
        <div className="absolute inset-0">
          <div className="absolute -left-24 -top-20 h-96 w-[36rem] -rotate-6 bg-white/5" />
          <div className="absolute -left-12 top-40 h-[44rem] w-[22rem] -rotate-[28deg] bg-white/8" />
          <div className="absolute left-0 top-32 h-px w-[56rem] rotate-[162deg] bg-cyan-300/70" />
          <div className="absolute -left-20 top-56 h-px w-[64rem] rotate-[148deg] bg-sky-200/70" />
          <div className="absolute right-[-12rem] top-[18rem] h-px w-[60rem] rotate-[152deg] bg-white/45" />
          <div className="absolute right-[-8rem] top-[30rem] h-px w-[44rem] rotate-[132deg] bg-white/35" />
          <div className="absolute bottom-24 left-10 size-28 rounded-full border-[12px] border-cyan-200/45" />
          <div className="absolute bottom-20 left-6 size-16 rounded-full border-[6px] border-cyan-300/45" />
          <div className="absolute bottom-16 left-28 size-12 rounded-full border-4 border-cyan-100/40" />
          <div className="absolute bottom-32 left-32 size-40 rounded-full border-[14px] border-sky-100/30" />
          <div className="absolute bottom-0 left-24 size-36 rounded-full border-[10px] border-cyan-100/30" />
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#f3f3f3] px-8 py-12 sm:px-12">
        <div className="w-full max-w-[370px]">
          <div className="mb-10 flex items-center gap-3">
            <div className="relative grid size-12 place-items-center rounded-full bg-[#263d7c] text-white">
              <span className="text-base leading-none">*</span>
              <span className="absolute right-3 top-2 size-1 rounded-full bg-white/80" />
              <span className="absolute right-2 top-4 size-1 rounded-full bg-white/80" />
              <span className="absolute right-4 top-5 size-1 rounded-full bg-white/80" />
            </div>
            <div>
              <p className="text-[42px] leading-none text-[#2f417d]">TARA</p>
              <p className="text-[11px] font-semibold uppercase text-[#2f417d]">Talent Acquisition & Recruitment Assistant</p>
            </div>
          </div>

          <h1 className="text-balance text-[28px] font-semibold text-[#111827]">Sign in with your organizational account.</h1>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="email" className="text-base font-normal text-[#111827]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 border-slate-300 bg-white text-base placeholder:text-slate-400 focus:border-[#1f8bff]"
                required
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-base font-normal text-[#111827]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 border-slate-300 bg-white text-base placeholder:text-slate-400 focus:border-[#1f8bff]"
                required
              />
            </div>

            <ErrorBanner message={error} />

            <Button
              type="submit"
              disabled={busy}
              className="h-11 rounded-md bg-[#1f8bff] px-6 text-base font-medium text-white hover:bg-[#117de8]"
            >
              {busy ? "Signing in..." : "Log In"}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
