"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";

export function RouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicJourney = pathname === "/journey" || pathname.startsWith("/journey/");

  if (isPublicJourney) {
    return <>{children}</>;
  }

  // Keep the shared shell mounted across application navigation, including
  // Risk Calculator. AppShell already owns the authenticated-vs-guest decision
  // for that public-capable route, so duplicating the auth check here caused
  // the sidebar/header to disappear briefly during client-side navigation.
  return <AppShell>{children}</AppShell>;
}
