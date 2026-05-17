"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Building2,
  Handshake,
  LayoutDashboard,
  Layers,
  Plus,
  Settings,
  UsersRound,
  X,
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import { getCandidate } from "@/lib/services/candidates";
import { getClient } from "@/lib/services/clients";
import { logout } from "@/lib/services/auth";
import { useBulkResumeParseStore } from "@/lib/stores/bulk-resume-parse-store";
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

type QuickAddItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  chipClass: string;
};

const appTiles: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, chipClass: "bg-sky-500" },
  { href: "/clients", label: "Client", icon: Building2, chipClass: "bg-blue-500" },
  { href: "/vendors", label: "Business Partner", icon: Building2, chipClass: "bg-indigo-500" },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness, chipClass: "bg-rose-500" },
  { href: "/candidates", label: "Candidate", icon: UsersRound, chipClass: "bg-emerald-500" },
  { href: "/settings/other", label: "Settings", icon: Settings, chipClass: "bg-slate-500" },
];

const quickAddItems: QuickAddItem[] = [
  { href: "/clients", label: "Client", icon: Building2, chipClass: "bg-blue-500" },
  { href: "/vendors", label: "Business Partner", icon: Handshake, chipClass: "bg-amber-500" },
  { href: "/candidates", label: "Candidate", icon: UsersRound, chipClass: "bg-emerald-500" },
  { href: "/jobs", label: "Job", icon: BriefcaseBusiness, chipClass: "bg-rose-500" },
];

const TAB_STORAGE_KEY = "tara_open_tabs_v2";
const LAST_PROTECTED_ROUTE_KEY = "tara_last_protected_route_v1";
const PROTECTED_ROUTE_PREFIXES = ["/dashboard", "/clients", "/vendors", "/jobs", "/candidates", "/settings", "/links", "/audit", "/reporting"];

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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const quickAddRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const bulkParseInputRef = useRef<HTMLInputElement | null>(null);

  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);
  const replaceBulkParseFiles = useBulkResumeParseStore((state) => state.replaceFiles);

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
    setQuickAddOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!quickAddOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!quickAddRef.current) return;
      const target = event.target as Node | null;
      if (target && !quickAddRef.current.contains(target)) {
        setQuickAddOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuickAddOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [quickAddOpen]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!profileMenuRef.current) return;
      const target = event.target as Node | null;
      if (target && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [profileMenuOpen]);

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
    const match = pathname.match(/^\/clients\/(\d+)(?:\/.*)?$/);
    if (!match) return;
    const clientId = Number(match[1]);
    if (!Number.isInteger(clientId) || clientId <= 0) return;

    let cancelled = false;
    getClient(clientId, true)
      .then((client) => {
        if (cancelled) return;
        const clientName = client.name?.trim() || `Client ${client.id}`;
        setOpenTabs((prev) =>
          prev.map((tab) => (tab.href === pathname ? { ...tab, label: clientName } : tab)),
        );
      })
      .catch(() => {
        // Keep default tab label if client lookup fails.
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
    },
    [router],
  );

  const addAppTab = useCallback(
    (href: string) => {
      setOpenTabs((prev) => normalizeTabs([...prev, makeTab(href)]));
      router.push(href);
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
      await logout();
    } catch {
      // Ignore logout API failures because local cleanup is enough.
    } finally {
      clearSession();
      router.replace("/login");
      setBusy(false);
    }
  }, [session, busy, clearSession, router]);

  const onQuickAddSelect = useCallback(
    (href: string) => {
      setQuickAddOpen(false);
      setOpenTabs((prev) => normalizeTabs([...prev, makeTab(href)]));
      router.push(href);
    },
    [router],
  );

  const onOpenSettings = useCallback(() => {
    setProfileMenuOpen(false);
    setOpenTabs((prev) => normalizeTabs([...prev, makeTab("/settings", "Settings")]));
    router.push("/settings");
  }, [router]);

  const onBulkParseFilesSelected = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    replaceBulkParseFiles(files);
    event.target.value = "";
    setOpenTabs((prev) => normalizeTabs([...prev, makeTab("/candidates/bulk-parse", "Bulk Parse")]));
    router.push("/candidates/bulk-parse");
  }, [replaceBulkParseFiles, router]);

  return (
    <div className="h-dvh overflow-hidden bg-slate-100 text-slate-900">
      <header className="flex h-14 items-center justify-between border-b border-white/10 bg-[#10131d] px-3 text-white">
        <div className="flex items-center gap-4">
          <Image
            src="/tara-logo.svg"
            alt="TARA logo"
            width={170}
            height={36}
            priority
            className="h-8 w-auto brightness-0 invert"
          />

          <div ref={quickAddRef} className="relative hidden md:block">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white/10",
                quickAddOpen && "bg-white/15",
              )}
              onClick={() => setQuickAddOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={quickAddOpen}
              aria-label="Open add menu"
            >
              <Plus className="size-4" />
              Add
            </button>

            {quickAddOpen ? (
              <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded border border-slate-300 bg-white text-slate-900 shadow-xl animate-scale-in">
                <div className="flex items-center gap-2 bg-blue-500 px-3 py-2 text-base font-medium text-white">
                  <Plus className="size-4" />
                  Add
                </div>
                <div className="p-2">
                  {quickAddItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => onQuickAddSelect(item.href)}
                        className="flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                        role="menuitem"
                      >
                        <span className={cn("grid size-7 place-items-center rounded-md text-white", item.chipClass)}>
                          <Icon className="size-4" />
                        </span>
                        <span className="leading-none">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded px-1 py-1 hover:bg-white/10"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label="Open profile menu"
            >
              <span className="hidden max-w-40 truncate md:inline">{displayName}</span>
              <span className="grid size-7 place-items-center rounded-full bg-amber-400 text-xs font-semibold text-ink">
                {getInitials(displayName)}
              </span>
            </button>
            {profileMenuOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded border border-slate-300 bg-white py-1 text-sm text-slate-900 shadow-xl animate-scale-in">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100"
                  role="menuitem"
                >
                  <Settings className="size-4" />
                  Settings
                </button>
              </div>
            ) : null}
          </div>
          <Button variant="ghost" onClick={onLogout} disabled={busy} className="h-8 border-white/25 bg-white/10 text-white hover:bg-white/20">
            {busy ? "Signing out..." : "Logout"}
          </Button>
        </div>
      </header>

      <div className="grid h-[calc(100dvh-56px)] grid-cols-[12rem_minmax(0,1fr)] overflow-hidden">
        <aside className="flex min-h-0 flex-col border-r border-white/10 bg-[#111827]">
          <div className="flex h-12 items-center border-b border-white/10 px-3 text-sm font-medium text-slate-200">
            Menu
          </div>

          <div className="flex-1 overflow-auto py-2">
            {openTabs.map((tab) => {
              return (
                <div key={tab.id} className="mx-2 mb-1 flex items-center rounded bg-white/[0.03] animate-fade-in">
                  <button
                    type="button"
                    onClick={() => openRoute(tab.href)}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-l px-3 py-2 text-left text-sm",
                      pathname === tab.href ? "bg-white/12 text-white" : "text-slate-300 hover:bg-white/[0.07] hover:text-white",
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
                    className="grid size-9 place-items-center rounded-r text-slate-500 hover:bg-white/[0.07] hover:text-slate-200"
                    aria-label={`Remove ${tab.label} tab`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-auto border-t border-white/10 bg-white/[0.02]">
            <div className="px-3 py-3">
              <input
                ref={bulkParseInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                multiple
                className="hidden"
                onChange={onBulkParseFilesSelected}
              />
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start border border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                onClick={() => bulkParseInputRef.current?.click()}
              >
                <Layers className="mr-2 size-4" />
                Bulk Parse
              </Button>
            </div>
            <div className="border-t border-white/10 px-3 py-2 text-xs text-slate-500">Powered by Nalashaa</div>
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-slate-100">
          <section className="border-b border-slate-200 bg-white px-3 py-3 md:px-4">
            <div className="w-full">
              <div className="mb-2">
                <p className="text-xs font-medium text-blue-700">{timeLabel}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {appTiles.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => addAppTab(item.href)}
                      className="flex min-h-20 flex-col items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-center shadow-sm hover:border-blue-200 hover:bg-blue-50"
                    >
                      <span className={cn("grid size-10 place-items-center rounded-xl text-white", item.chipClass)}>
                        <Icon className="size-5" />
                      </span>
                      <span className="mt-2 text-xs font-semibold text-slate-900">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="px-3 py-3 md:px-4">
            <div className="w-full">
              <div className="rounded border border-slate-200 bg-white p-3 text-slate-900 shadow-sm md:p-4">
                {showMainContent ? children : (
                  <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
                    Open a section from the top menu.
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
