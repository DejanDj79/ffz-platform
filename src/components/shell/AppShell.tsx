"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import styles from "./AppShell.module.css";
import { EconomicCalendarAlert } from "@/components/economic-calendar/EconomicCalendarAlert";

type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: "USER" | "CREATOR";
};

type NavChild = {
  href: string;
  label: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  section: "workspace" | "tracking";
  children?: NavChild[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", section: "workspace" },
  { href: "/trading-desk", label: "Trading Desk", icon: "desk", section: "workspace" },
  { href: "/economic-calendar", label: "Economic Calendar", icon: "calendar", section: "workspace" },
  { href: "/tools/risk-calculator", label: "Risk Calculator", icon: "calc", section: "workspace" },
  { href: "/challenges", label: "Challenge / Funded", icon: "flag", section: "workspace" },
  {
    href: "/journal",
    label: "Journal",
    icon: "journal",
    section: "tracking",
    children: [
      { href: "/journal", label: "Trades" },
      { href: "/journal/import", label: "CSV Import" },
      { href: "/journal/analytics", label: "Analytics" },
    ],
  },
  { href: "/ledger", label: "Real Money Ledger", icon: "ledger", section: "tracking" },
  { href: "/scoreboard", label: "Scoreboard", icon: "scoreboard", section: "tracking" },
];

const PAGE_META: Array<{
  match: (pathname: string) => boolean;
  title: string;
  subtitle: string;
  icon: string;
}> = [
  {
    match: (pathname) => pathname === "/dashboard" || pathname === "/",
    title: "Dashboard",
    subtitle: "Your Futures From Zero workspace.",
    icon: "dashboard",
  },
  {
    match: (pathname) => pathname.startsWith("/trading-desk"),
    title: "Daily Trading Desk",
    subtitle: "Plan the session, enforce risk and review execution.",
    icon: "desk",
  },
  {
    match: (pathname) => pathname.startsWith("/economic-calendar"),
    title: "Economic Calendar",
    subtitle: "High-impact macro events that can move futures markets.",
    icon: "calendar",
  },
  {
    match: (pathname) => pathname.startsWith("/tools/risk-calculator"),
    title: "Risk Calculator",
    subtitle: "Position sizing for futures and prop challenges.",
    icon: "calc",
  },
  {
    match: (pathname) => pathname.startsWith("/challenges"),
    title: "Challenge / Funded",
    subtitle: "Track evaluation progress, funded protection and payout readiness.",
    icon: "flag",
  },
  {
    match: (pathname) => pathname.startsWith("/journal/import"),
    title: "CSV Trade Import",
    subtitle: "Import DeepCharts closed trades into your journal.",
    icon: "journal",
  },
  {
    match: (pathname) => pathname.startsWith("/journal/analytics"),
    title: "Journal Analytics",
    subtitle: "Measure trading performance and find repeatable edges.",
    icon: "journal",
  },
  {
    match: (pathname) => pathname.startsWith("/journal"),
    title: "Trade Journal",
    subtitle: "Plan trades, review execution and build a repeatable process.",
    icon: "journal",
  },
  {
    match: (pathname) => pathname.startsWith("/ledger"),
    title: "Real Money Ledger",
    subtitle: "Track challenge fees, resets, platform costs and real payouts.",
    icon: "ledger",
  },
  {
    match: (pathname) => pathname.startsWith("/scoreboard"),
    title: "Creator Scoreboard",
    subtitle: "Your Futures From Zero journey graphic for episodes and OBS.",
    icon: "scoreboard",
  },
];

function Icon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const icons: Record<string, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="4" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></>,
    desk: <><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M9 16v4M15 16v4M7 12l3-3 2 2 4-4 1 1"/></>,
    calc: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h.1M8 15h2M12 15h2M16 15h.1M8 18h2M12 18h4"/></>,
    flag: <><path d="M5 21V4"/><path d="M5 5h10l-1.5 3L15 11H5"/></>,
    journal: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22V4.5Z"/><path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19M9 6h6M9 10h6"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2"/></>,
    ledger: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4M7 16h6M16 14v4M14 16h4"/></>,
    scoreboard: <><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 8h3M14 8h3M7 12h10M8 21h8M12 18v3"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    database: <><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>,
    logout: <><path d="M10 5H5v14h5"/><path d="m15 8 4 4-4 4M19 12H9"/></>,
  };

  return <svg {...common}>{icons[name] ?? icons.dashboard}</svg>;
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname.startsWith(href);
}

function isSubActive(pathname: string, href: string) {
  if (href === "/journal") return pathname === "/journal";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isOverlayPage = pathname.startsWith("/overlays/");
  const bypassShell = isAuthPage || isOverlayPage;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (bypassShell) {
      setAuthState("unauthenticated");
      setUser(null);
      return;
    }

    let cancelled = false;

    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });

        if (!response.ok) {
          if (!cancelled) {
            setAuthState("unauthenticated");
            const next = encodeURIComponent(pathname);
            router.replace(`/login?next=${next}`);
          }
          return;
        }

        const json = await response.json() as { data: AuthUser };

        if (!cancelled) {
          setUser(json.data);
          setAuthState("authenticated");
        }
      } catch {
        if (!cancelled) {
          setAuthState("unauthenticated");
          router.replace("/login");
        }
      }
    }

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [bypassShell, pathname, router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setAuthState("unauthenticated");
    router.replace("/login");
    router.refresh();
  }

  const page = useMemo(
    () => PAGE_META.find((item) => item.match(pathname)) ?? PAGE_META[0],
    [pathname],
  );

  const workspaceItems = NAV_ITEMS.filter((item) => item.section === "workspace");
  const trackingItems = NAV_ITEMS.filter(
    (item) =>
      item.section === "tracking" &&
      (item.href !== "/scoreboard" || user?.role === "CREATOR"),
  );

  if (bypassShell) {
    return <>{children}</>;
  }

  if (authState !== "authenticated" || !user) {
    return (
      <div className={styles.authLoading}>
        <span />
        <strong>FFZ PLATFORM</strong>
        <small>Checking session...</small>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {mobileOpen && (
        <button
          className={styles.backdrop}
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <div className={styles.logoFrame}>
            <Image
              src="/ffz-logo.png"
              alt="Futures From Zero"
              width={420}
              height={130}
              priority
              className={styles.logo}
            />
          </div>
          <button
            className={styles.sidebarClose}
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          <NavSection title="WORKSPACE" items={workspaceItems} pathname={pathname} />
          <NavSection title="TRACKING" items={trackingItems} pathname={pathname} />
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.modeCard}>
            <span className={styles.modeIcon}><Icon name="database" /></span>
            <span>
              <strong>{user.role === "CREATOR" ? "CREATOR MODE" : "DATABASE MODE"}</strong>
              <small title={user.email}>{user.displayName || user.email}</small>
            </span>
            <i />
          </div>
          <button className={styles.logoutButton} type="button" onClick={logout}>
            <Icon name="logout" />
            <span>Sign out</span>
          </button>
          <p>FFZ Platform <span>v0.2</span></p>
        </div>
      </aside>

      <div className={styles.stage}>
        <div className={styles.mobileHeader}>
          <div className={styles.mobileLogoFrame}>
            <Image src="/ffz-logo.png" alt="Futures From Zero" width={300} height={90} className={styles.logo} />
          </div>
          <button type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Icon name="menu" />
          </button>
        </div>

        <header className={styles.pageHeader}>
          <div className={styles.pageIdentity}>
            <span className={styles.pageIcon}><Icon name={page.icon} /></span>
            <div>
              <span className={styles.eyebrow}>FFZ PLATFORM</span>
              <h1>{page.title}</h1>
              {/* <p>{page.subtitle}</p> */}
            </div>
          </div>

          {/* <div className={styles.dataChip}>
            <span className={styles.dataDot} />
            <span>
              <strong>POSTGRESQL</strong>
              <small>Authenticated account data</small>
            </span>
          </div> */}
        </header>

        {!pathname.startsWith("/economic-calendar") && (
          <EconomicCalendarAlert />
        )}

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

function NavSection({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <div className={styles.navSection}>
      <div className={styles.navTitle}>{title}</div>
      <div className={styles.navList}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <div key={`${item.section}-${item.href}`} className={styles.navEntry}>
              <Link href={item.href} className={`${styles.navItem} ${active ? styles.active : ""}`}>
                <span className={styles.navIcon}><Icon name={item.icon} /></span>
                <span>{item.label}</span>
                <span className={styles.navChevron}><Icon name="chevron" /></span>
              </Link>

              {item.children && (
                <div className={styles.subNav} aria-label={`${item.label} navigation`}>
                  {item.children.map((child) => {
                    const childActive = isSubActive(pathname, child.href);

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`${styles.subNavItem} ${childActive ? styles.subNavActive : ""}`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
