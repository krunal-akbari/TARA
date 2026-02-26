"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Building2,
  CircleHelp,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import { getCandidate } from "@/lib/services/candidates";
import { logout } from "@/lib/services/auth";
import { cn } from "@/lib/utils/cn";

type NavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  chipClass: string;
};

type OpenTab = {
  id: string;
  href: string;
  label: string;
};

const appTiles: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, chipClass: "bg-sky-500" },
  { href: "/clients", label: "Clients", icon: Building2, chipClass: "bg-blue-500" },
  { href: "/vendors", label: "Vendors", icon: Building2, chipClass: "bg-indigo-500" },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness, chipClass: "bg-rose-500" },
  { href: "/candidates", label: "Candidates", icon: UsersRound, chipClass: "bg-emerald-500" },
];

const TAB_STORAGE_KEY = "tara_open_tabs_v2";
const LAST_PROTECTED_ROUTE_KEY = "tara_last_protected_route_v1";
const PROTECTED_ROUTE_PREFIXES = ["/dashboard", "/clients", "/vendors", "/jobs", "/candidates", "/links", "/audit", "/reporting"];

function toTitleCase(value: string) {
  return value
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getInitials(name: string) {
  const pieces = name.split(" ").filter(Boolean);
  if (pieces.length === 0) return "U";
  if (pieces.length === 1) return pieces[0].slice(0, 2).toUpperCase();
  return `${pieces[0][0]}${pieces[1][0]}`.toUpperCase();
}

function isAllowedTabPath(path: string) {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function getDefaultTabLabel(href: string) {
  const tile = appTiles.find((item) => href === item.href || href.startsWith(`${item.href}/`));
  if (tile) return tile.label;
  const section = href.split("/").filter(Boolean)[0];
  return section ? toTitleCase(section) : "Workspace";
}

function makeTab(href: string, label?: string): OpenTab {
  return {
    id: `${href}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    href,
    label: label || getDefaultTabLabel(href),
  };
}

function normalizeTabs(tabItems: OpenTab[]) {
  const uniqueByHref = new Map<string, OpenTab>();
  for (const tab of tabItems) {
    if (!isAllowedTabPath(tab.href)) continue;
    uniqueByHref.set(tab.href, {
      id: tab.id || `${tab.href}-${uniqueByHref.size + 1}`,
      href: tab.href,
      label: tab.label || getDefaultTabLabel(tab.href),
    });
  }

  return Array.from(uniqueByHref.values());
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);

  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);

  const displayName = useMemo(() => {
    const user = session?.user;
    const fullName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
    if (fullName) return fullName;
    const emailPrefix = user?.email?.split("@")[0] ?? "User";
    return toTitleCase(emailPrefix);
  }, [session]);

  const timeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(now),
    [now],
  );

  const showMainContent = useMemo(() => {
    if (openTabs.length === 0) return false;
    return openTabs.some((tab) => tab.href === pathname);
  }, [openTabs, pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (window.innerWidth >= 1024) setLauncherOpen(true);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024) setLauncherOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;

      if (parsed.every((item) => typeof item === "string")) {
        const fromLegacy = (parsed as string[]).map((href) => makeTab(href, getDefaultTabLabel(href)));
        setOpenTabs(normalizeTabs(fromLegacy));
        return;
      }

      const fromObjects = (parsed as Array<OpenTab | { id?: string; href?: string; label?: string }>).filter(
        (item) => item && typeof item === "object" && typeof item.href === "string",
      ).map((item) => ({
        id: item.id || "",
        href: item.href as string,
        label: typeof item.label === "string" ? item.label : getDefaultTabLabel(item.href as string),
      }));
      setOpenTabs(normalizeTabs(fromObjects));
    } catch {
      // ignore invalid local storage values
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LAST_PROTECTED_ROUTE_KEY, pathname);
  }, [pathname]);

  useEffect(() => {
    if (!isAllowedTabPath(pathname)) return;
    setOpenTabs((prev) => {
      if (prev.some((tab) => tab.href === pathname)) return prev;
      return normalizeTabs([...prev, makeTab(pathname, getDefaultTabLabel(pathname))]);
    });
  }, [pathname]);

  useEffect(() => {
    const match = pathname.match(/^\/candidates\/(\d+)(?:\/.*)?$/);
    if (!match) return;
    const candidateId = Number(match[1]);
    if (!Number.isInteger(candidateId) || candidateId <= 0) return;

    let cancelled = false;
    getCandidate(candidateId, true)
      .then((candidate) => {
        if (cancelled) return;
        const candidateName = `${candidate.first_name} ${candidate.last_name}`.trim() || `Candidate ${candidate.id}`;
        setOpenTabs((prev) =>
          prev.map((tab) => (tab.href === pathname ? { ...tab, label: candidateName } : tab)),
        );
      })
      .catch(() => {
        // Keep default tab label if candidate lookup fails.
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    window.localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(openTabs));
  }, [openTabs]);

  const openRoute = useCallback(
    (href: string) => {
      router.push(href);
      if (window.innerWidth < 1024) setLauncherOpen(false);
    },
    [router],
  );

  const addAppTab = useCallback(
    (href: string) => {
      setOpenTabs((prev) => normalizeTabs([...prev, makeTab(href)]));
      router.push(href);
      if (window.innerWidth < 1024) setLauncherOpen(false);
    },
    [router],
  );

  const removeAppTab = useCallback(
    (tabId: string) => {
      setOpenTabs((prev) => {
        const removed = prev.find((item) => item.id === tabId);
        const next = normalizeTabs(prev.filter((item) => item.id !== tabId));

        if (removed && removed.href === pathname && next.length > 0) {
          const fallback = next[next.length - 1];
          window.setTimeout(() => router.push(fallback.href), 0);
        }

        return next;
      });
    },
    [router, pathname],
  );

  const onLogout = useCallback(async () => {
    if (!session || busy) {
      clearSession();
      router.replace("/login");
      return;
    }

    setBusy(true);
    try {
      await logout({ refresh_token: session.refreshToken });
    } catch {
      // Ignore logout API failures because local cleanup is enough.
    } finally {
      clearSession();
      router.replace("/login");
      setBusy(false);
    }
  }, [session, busy, clearSession, router]);

  return (
    <div className="h-dvh overflow-hidden bg-slate-200 text-slate-900">
      <header className="flex h-14 items-center justify-between border-b border-slate-900 bg-[#1f2b52] px-3 text-white">
        <div className="flex items-center gap-4">
          <Image src="/tara-logo.svg" alt="TARA logo" width={170} height={36} priority className="h-8 w-auto" />

          <button type="button" className="hidden items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white/10 md:inline-flex">
            <Search className="size-4" />
            Find
          </button>
          <button type="button" className="hidden items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white/10 md:inline-flex">
            <Plus className="size-4" />
            Add
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <a href="#" className="hidden hover:underline md:inline">Privacy</a>
          <a href="#" className="hidden items-center gap-1 hover:underline md:inline-flex">
            <CircleHelp className="size-4" />
            Help
          </a>
          <div className="h-5 w-px bg-white/25" />
          <span className="hidden max-w-40 truncate md:inline">{displayName}</span>
          <div className="grid size-7 place-items-center rounded-full bg-amber-400 text-xs font-semibold text-[#1f2b52]">
            {getInitials(displayName)}
          </div>
          <Button variant="ghost" onClick={onLogout} disabled={busy} className="h-8 border-white/25 bg-white/10 text-white hover:bg-white/20">
            {busy ? "Signing out..." : "Logout"}
          </Button>
        </div>
      </header>

      <div className="relative h-[calc(100dvh-56px)] overflow-hidden">
        <aside className="absolute inset-y-0 left-0 z-20 flex border-r border-slate-400">
          <div className="flex w-40 flex-col border-r border-slate-300 bg-slate-100">
            <button
              type="button"
              onClick={() => setLauncherOpen((prev) => !prev)}
              className="flex h-12 items-center gap-2 border-b border-slate-300 px-3 text-left text-slate-700 hover:bg-slate-200"
              aria-label={launcherOpen ? "Hide launcher tiles" : "Show launcher tiles"}
            >
              <Menu className="size-4" />
              Menu
            </button>

            <div className="flex-1 overflow-auto">
              {openTabs.map((tab) => {
                return (
                  <div key={tab.id} className="flex items-center border-b border-slate-300">
                    <button
                      type="button"
                      onClick={() => openRoute(tab.href)}
                      className={cn(
                        "flex-1 px-3 py-2 text-left text-base",
                        pathname === tab.href ? "bg-slate-200 text-slate-900" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                      )}
                    >
                      {tab.label}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeAppTab(tab.id);
                      }}
                      className="px-2 text-slate-500 hover:text-slate-700"
                      aria-label={`Remove ${tab.label} tab`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-auto border-t border-slate-300 px-3 py-2 text-xs text-slate-500">Powered by Nalashaa</div>
          </div>

          {launcherOpen ? (
            <div className="w-[24rem] bg-[#020c25] px-5 py-4 text-white">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs text-blue-200">{timeLabel}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {appTiles.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => addAppTab(item.href)}
                      className="flex flex-col items-center rounded-md px-2 py-2 text-center hover:bg-white/10"
                    >
                      <span className={cn("grid size-11 place-items-center rounded-xl text-white", item.chipClass)}>
                        <Icon className="size-5" />
                      </span>
                      <span className="mt-2 text-xs">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </aside>

        <main className={cn("h-full overflow-y-auto p-4 md:p-6 lg:pl-40", launcherOpen && "lg:pl-[34rem]")}>
          {showMainContent ? children : null}
        </main>
      </div>

      {launcherOpen ? (
        <button
          type="button"
          className="fixed inset-y-14 right-0 left-40 z-10 bg-slate-900/20 lg:hidden"
          onClick={() => setLauncherOpen(false)}
          aria-label="Close app launcher backdrop"
        />
      ) : null}
    </div>
  );
}
