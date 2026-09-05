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

  // Keep the shared shell mounted across authenticated navigation, including
  // Risk Calculator. AppShell already handles the calculator's guest/public
  // fallback, so a second auth check here only causes the sidebar to unmount
  // briefly while navigating to /tools/risk-calculator.
  return <AppShell>{children}</AppShell>;
}
